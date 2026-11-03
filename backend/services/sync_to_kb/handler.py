"""
Khung 4 - Đồng bộ KB theo CDC (DynamoDB Streams -> Gemini embedding -> S3 vectors).

Khác bản quét toàn bảng:
  * Chỉ xử lý các record trong event: INSERT/MODIFY -> embed phần NewImage, REMOVE -> xoá theo Keys.
  * Chỉ gọi Gemini cho mục có NỘI DUNG NGỮ NGHĨA thay đổi. Đổi giá/tồn kho chỉ cập nhật trường
    trong kb.json (không embed lại) vì search_text không chứa giá/tồn kho;
    orchestrator vẫn đọc giá/tồn kho mới nhất từ DynamoDB lúc trả lời.
  * Ghi S3 có điều kiện (If-Match theo ETag) + đọc-sửa-ghi lại khi bị ghi đè, nên 2 batch song song
    không làm mất thay đổi của nhau.
  * Lỗi -> raise để Streams retry (xử lý idempotent). Bật bisect_batch_on_function_error + DLQ.
  * Gọi tay: {"action": "full_resync"} quét lại cả 2 bảng (có phân trang) nhưng vẫn tái dùng embedding
    đã có nếu nội dung không đổi.

Định dạng file S3 giữ nguyên như orchestrator đang đọc:
  vectors/kb.json       {"meta": {...}, "items": [{chunk_id, source_file, text, embedding}]}
  vectors/products.json {"meta": {...}, "items": [{ProductID, name, ..., search_text, embedding}]}
"""
import json
import math
import os
import re
import time
from decimal import Decimal

import boto3
from boto3.dynamodb.types import TypeDeserializer
from botocore.exceptions import ClientError

REGION = os.getenv("AWS_REGION", "ap-southeast-1")
VECTOR_BUCKET = os.getenv("VECTOR_BUCKET", "chatbot-kb-741796256397-dev")
VECTOR_PREFIX = os.getenv("VECTOR_PREFIX", "vectors/")
KB_KEY = VECTOR_PREFIX + os.getenv("KB_VECTOR_FILE", "kb.json")
PRODUCT_KEY = VECTOR_PREFIX + os.getenv("PRODUCT_VECTOR_FILE", "products.json")
GEMINI_SSM_PARAM = os.getenv("GEMINI_SSM_PARAM", "/chatbot/gemini_api_key")
PRODUCTS_TABLE = os.getenv("PRODUCTS_TABLE", "Products_Replica")
POLICIES_TABLE = os.getenv("POLICIES_TABLE", "StorePolicies_Replica")

EMBED_MODEL = os.getenv("EMBED_MODEL", "gemini-embedding-001")
EMBED_DIM = int(os.getenv("EMBED_DIM", "768"))
EMBED_BATCH = 20
MAX_WRITE_RETRIES = 4

# Trường chỉ-để-hiển thị: đổi các trường này KHÔNG cần embed lại.
PRODUCT_FIELDS = [
    "ProductID", "name", "price", "stock", "status", "image_url",
    "compatible_models", "description", "category", "brand", "specs"
]

s3 = boto3.client("s3", region_name=REGION)
ssm = boto3.client("ssm", region_name=REGION)
dynamodb = boto3.resource("dynamodb", region_name=REGION)
_deser = TypeDeserializer()
_api_key = None
_embed_cache = {}


# ---------- tiện ích ----------
def to_native(o):
    if isinstance(o, Decimal):
        return int(o) if o == o.to_integral_value() else float(o)
    if isinstance(o, dict):
        return {k: to_native(v) for k, v in o.items()}
    if isinstance(o, (list, set, tuple)):
        return [to_native(v) for v in o]
    return o


def from_stream_image(image):
    """DynamoDB-JSON ({'S': ..}) -> dict Python thường."""
    return to_native({k: _deser.deserialize(v) for k, v in (image or {}).items()})


def normalize(vec):
    n = math.sqrt(sum(x * x for x in vec))
    return [x / n for x in vec] if n else list(vec)


def now_iso():
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def get_api_key():
    global _api_key
    if not _api_key:
        _api_key = ssm.get_parameter(Name=GEMINI_SSM_PARAM, WithDecryption=True)["Parameter"]["Value"].strip()
    return _api_key


def embed_documents(texts):
    """Gemini embedding, có retry/backoff. Trả về list vector đã chuẩn hoá (768 chiều)."""
    if not texts:
        return []
    missing = [t for t in dict.fromkeys(texts) if t not in _embed_cache]  # retry 412 không tốn thêm lượt gọi
    if missing:
        _embed_cache.update(zip(missing, _call_gemini(missing)))
    return [_embed_cache[t] for t in texts]


def _call_gemini(texts):
    from google import genai
    from google.genai import types
    client = genai.Client(api_key=get_api_key())
    out = []
    for i in range(0, len(texts), EMBED_BATCH):
        chunk = texts[i:i + EMBED_BATCH]
        for attempt in range(4):
            try:
                r = client.models.embed_content(
                    model=EMBED_MODEL,
                    contents=chunk,
                    config=types.EmbedContentConfig(
                        task_type="RETRIEVAL_DOCUMENT",
                        output_dimensionality=EMBED_DIM
                    )
                )
                out += [[round(x, 6) for x in normalize(e.values)] for e in r.embeddings]
                break
            except Exception as exc:  # 429 / lỗi mạng
                if attempt == 3:
                    raise
                print(f"[DATA_SYNC] Embed error, retrying ({attempt + 1}):", str(exc)[:120])
                time.sleep(2 ** attempt)
    return out


# ---------- chuẩn hoá nội dung (giống scripts/build_vector_snapshot.py) ----------
def chunk_text(text, max_chars=700):
    parts = [p.strip() for p in re.split(r"\n\s*\n", (text or "").strip()) if p.strip()]
    if not parts:
        return []
    title, body = parts[0], parts[1:]
    if not body:
        return [title]
    out = []
    for p in body:
        if len(p) <= max_chars:
            out.append(p)
            continue
        cur = ""
        for s in re.split(r"(?<=[.!?])\s+", p):
            if cur and len(cur) + len(s) + 1 > max_chars:
                out.append(cur)
                cur = s
            else:
                cur = (cur + " " + s).strip()
        if cur:
            out.append(cur)
    return [f"{title}\n{c}" for c in out]


def product_text(p):
    """Văn bản đem embed: KHÔNG chứa giá/tồn kho (hai thứ hay đổi nhưng không đổi ngữ nghĩa)."""
    models = p.get("compatible_models") or []
    if not isinstance(models, list):
        models = [str(models)]
    return (
        f"{p.get('name', '')}. Danh mục: {p.get('category', '')}. Hãng: {p.get('brand', '')}. "
        f"Lắp vừa xe: {'; '.join(models)}. Thông số: {p.get('specs', '')}. Mô tả: {p.get('description', '')}"
    )


def policy_chunks(item):
    pid = item["PolicyID"]
    title = item.get("title") or pid
    return [
        {"chunk_id": f"{pid}#{i}", "source_file": f"{title}.txt", "text": c}
        for i, c in enumerate(chunk_text(item.get("content", "")))
    ]


def product_doc(item):
    d = {k: item[k] for k in PRODUCT_FIELDS if k in item}
    d["search_text"] = product_text(item)
    return d


# ---------- S3: đọc-sửa-ghi có điều kiện ----------
def read_store(key):
    try:
        r = s3.get_object(Bucket=VECTOR_BUCKET, Key=key)
        return json.loads(r["Body"].read()), r["ETag"]
    except ClientError as exc:
        if exc.response["Error"]["Code"] in ("NoSuchKey", "404"):
            return {"meta": {}, "items": []}, None
        raise


def write_store(key, items, etag, source):
    body = json.dumps({
        "meta": {"model": EMBED_MODEL, "dim": EMBED_DIM, "built_at": now_iso(), "source": source},
        "items": items
    }, ensure_ascii=False).encode("utf-8")
    kw = dict(Bucket=VECTOR_BUCKET, Key=key, Body=body, ContentType="application/json")
    kw["IfMatch" if etag else "IfNoneMatch"] = etag or "*"
    s3.put_object(**kw)


def update_store(key, source, apply_fn):
    """apply_fn(items) -> items mới. Nếu file bị ghi đè giữa chừng (412) thì đọc lại và làm lại."""
    for attempt in range(MAX_WRITE_RETRIES):
        data, etag = read_store(key)
        items = apply_fn(data.get("items", []))
        try:
            write_store(key, items, etag, source)
            return len(items)
        except ClientError as exc:
            code = exc.response["Error"]["Code"]
            if code in ("PreconditionFailed", "ConditionalRequestConflict", "412") and attempt < MAX_WRITE_RETRIES - 1:
                print(f"[DATA_SYNC] {key} concurrency conflict (412), retrying (attempt {attempt + 2})")
                time.sleep(0.2 * (attempt + 1))
                continue
            raise


# ---------- áp thay đổi lên danh sách ----------
def apply_products(items, upserts, deletes):
    by_id = {it["ProductID"]: it for it in items if it.get("ProductID")}
    for pid in deletes:
        by_id.pop(pid, None)
    todo = []  # (doc cần embed)
    for pid, rec in upserts.items():
        doc = product_doc(rec)
        old = by_id.get(pid)
        if old and old.get("search_text") == doc["search_text"] and old.get("embedding"):
            old.update({k: v for k, v in doc.items() if k != "search_text"})  # chỉ đổi giá/tồn kho/ảnh...
            for k in [k for k in PRODUCT_FIELDS if k not in doc and k in old]:
                old.pop(k)
        else:
            todo.append(doc)
    for doc, vec in zip(todo, embed_documents([d["search_text"] for d in todo])):
        doc["embedding"] = vec
        by_id[doc["ProductID"]] = doc
    print(f"products: upsert={len(upserts)} embed_moi={len(todo)} xoa={len(deletes)}")
    return list(by_id.values())


def apply_policies(items, upserts, deletes):
    prefixes = {f"{pid}#" for pid in list(upserts) + list(deletes)}
    old_by_text = {
        (it["chunk_id"].split("#")[0], it["text"]): it
        for it in items
        if it.get("chunk_id") and it.get("embedding")
    }
    kept = [it for it in items if not any(it.get("chunk_id", "").startswith(p) for p in prefixes)]
    new_chunks = [c for pid, rec in upserts.items() for c in policy_chunks({**rec, "PolicyID": pid})]
    todo = []
    for c in new_chunks:
        reuse = old_by_text.get((c["chunk_id"].split("#")[0], c["text"]))
        if reuse:
            c["embedding"] = reuse["embedding"]  # đoạn không đổi -> khỏi embed lại
        else:
            todo.append(c)
    for c, vec in zip(todo, embed_documents([c["text"] for c in todo])):
        c["embedding"] = vec
    print(f"policies: upsert={len(upserts)} chunk_moi={len(todo)}/{len(new_chunks)} xoa={len(deletes)}")
    return kept + new_chunks


# ---------- đọc event ----------
def table_of(record):
    arn = record.get("eventSourceARN", "")
    m = re.search(r":table/([^/]+)/stream", arn)
    return m.group(1) if m else ""


def collect_changes(records):
    """Gộp theo khoá: bản ghi sau cùng của mỗi khoá thắng."""
    prod_up, prod_del, pol_up, pol_del = {}, set(), {}, set()
    for rec in records:
        ddb = rec.get("dynamodb", {})
        table, kind = table_of(rec), rec.get("eventName")
        if table == PRODUCTS_TABLE:
            key = from_stream_image(ddb.get("Keys")).get("ProductID")
            if not key:
                continue
            if kind == "REMOVE":
                prod_up.pop(key, None)
                prod_del.add(key)
            else:
                prod_del.discard(key)
                prod_up[key] = from_stream_image(ddb.get("NewImage"))
        elif table == POLICIES_TABLE:
            key = from_stream_image(ddb.get("Keys")).get("PolicyID")
            if not key:
                continue
            if kind == "REMOVE":
                pol_up.pop(key, None)
                pol_del.add(key)
            else:
                pol_del.discard(key)
                pol_up[key] = from_stream_image(ddb.get("NewImage"))
        else:
            print(f"[DATA_SYNC] Ignored record from unknown table: {table}")
    return prod_up, prod_del, pol_up, pol_del


def scan_all(table_name):
    table, items, kw = dynamodb.Table(table_name), [], {}
    while True:
        r = table.scan(**kw)
        items += [to_native(i) for i in r.get("Items", [])]
        if not r.get("LastEvaluatedKey"):
            return items
        kw["ExclusiveStartKey"] = r["LastEvaluatedKey"]


def full_resync():
    """Quét lại 2 bảng, ghi đè theo bảng nhưng tái dùng embedding khi nội dung không đổi."""
    products = {p["ProductID"]: p for p in scan_all(PRODUCTS_TABLE) if p.get("ProductID")}
    policies = {p["PolicyID"]: p for p in scan_all(POLICIES_TABLE) if p.get("PolicyID")}

    def prod_fn(items):
        stale = {it["ProductID"] for it in items if it.get("ProductID") and it["ProductID"] not in products}
        return apply_products(items, products, stale)

    def pol_fn(items):
        stale = {it["chunk_id"].split("#")[0] for it in items if it.get("chunk_id")} - set(policies)
        return apply_policies(items, policies, stale)

    n_p = update_store(PRODUCT_KEY, "Products_full_resync", prod_fn)
    n_k = update_store(KB_KEY, "StorePolicies_full_resync", pol_fn)
    return {"products": n_p, "kb_chunks": n_k}


def lambda_handler(event, context):
    records = (event or {}).get("Records") or []
    if not records:
        if (event or {}).get("action") == "full_resync":
            res = full_resync()
            print("[DATA_SYNC] full_resync completed:", res)
            return {"statusCode": 200, "body": json.dumps(res)}
        return {"statusCode": 400, "body": "Không có Records; gọi tay bằng {\"action\": \"full_resync\"}"}

    prod_up, prod_del, pol_up, pol_del = collect_changes(records)
    out = {}
    if prod_up or prod_del:
        out["products"] = update_store(
            PRODUCT_KEY, "Products_CDC",
            lambda items: apply_products(items, prod_up, prod_del)
        )
    if pol_up or pol_del:
        out["kb_chunks"] = update_store(
            KB_KEY, "StorePolicies_CDC",
            lambda items: apply_policies(items, pol_up, pol_del)
        )
    return {"statusCode": 200, "body": json.dumps(out)}
