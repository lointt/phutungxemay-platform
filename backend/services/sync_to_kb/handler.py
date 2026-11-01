"""
Khung 4: Data Sync Handler (DynamoDB Streams CDC -> S3 Vector KB)
Lắng nghe sự kiện Change Data Capture (CDC) từ DynamoDB Streams:
1. Bảng StorePolicies_Replica: Tự động trích xuất chính sách, gọi Gemini Embedding và đẩy lên vectors/kb.json
2. Bảng Products_Replica: Tự động cập nhật danh mục sản phẩm, gọi Gemini Embedding và đẩy lên vectors/products.json
Thay thế hoàn toàn script chạy bằng tay build_vector_snapshot.py!
"""
import json
import math
import os
import time
import boto3
from decimal import Decimal

REGION = os.getenv("AWS_REGION", "ap-southeast-1")
VECTOR_BUCKET = os.getenv("VECTOR_BUCKET", "chatbot-kb-741796256397-dev")
GEMINI_SSM_PARAM = os.getenv("GEMINI_SSM_PARAM", "/chatbot/gemini_api_key")
PRODUCTS_TABLE = os.getenv("PRODUCTS_TABLE", "Products_Replica")
POLICIES_TABLE = os.getenv("POLICIES_TABLE", "StorePolicies_Replica")

EMBED_MODEL = "gemini-embedding-001"
EMBED_DIM = 768

s3 = boto3.client("s3", region_name=REGION)
ssm = boto3.client("ssm", region_name=REGION)
dynamodb = boto3.resource("dynamodb", region_name=REGION)

_api_key_cache = None


def get_gemini_api_key():
    global _api_key_cache
    if _api_key_cache:
        return _api_key_cache
    resp = ssm.get_parameter(Name=GEMINI_SSM_PARAM, WithDecryption=True)
    _api_key_cache = resp["Parameter"]["Value"].strip()
    return _api_key_cache


def normalize_vector(v):
    norm = math.sqrt(sum(x * x for x in v))
    if norm < 1e-9:
        return v
    return [x / norm for x in v]


def embed_texts(texts):
    from google import genai
    from google.genai import types

    api_key = get_gemini_api_key()
    client = genai.Client(api_key=api_key)

    vectors = []
    # Batch theo 20 item mỗi lần
    batch_size = 20
    for i in range(0, len(texts), batch_size):
        chunk = texts[i : i + batch_size]
        res = client.models.embed_content(
            model=EMBED_MODEL,
            contents=chunk,
            config=types.EmbedContentConfig(
                task_type="RETRIEVAL_DOCUMENT",
                output_dimensionality=EMBED_DIM,
            ),
        )
        for emb in res.embeddings:
            vectors.append(normalize_vector(emb.values))
        time.sleep(0.5)  # Tránh rate limit
    return vectors


def chunk_policy_text(text, max_chars=700):
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    chunks = []
    current = ""
    for p in paragraphs:
        if len(current) + len(p) + 2 <= max_chars:
            current = (current + "\n\n" + p).strip()
        else:
            if current:
                chunks.append(current)
            current = p
    if current:
        chunks.append(current)
    return chunks or [text]


def sync_store_policies():
    print(f"[DATA_SYNC] Bắt đầu đồng bộ chính sách từ {POLICIES_TABLE}...")
    table = dynamodb.Table(POLICIES_TABLE)
    resp = table.scan()
    items = resp.get("Items", [])

    kb_chunks = []
    for item in items:
        pid = item.get("PolicyID", "POL_UNKNOWN")
        title = item.get("title", pid)
        content = item.get("content", "")
        chunks = chunk_policy_text(content)
        for idx, c in enumerate(chunks):
            kb_chunks.append({
                "chunk_id": f"{pid}#{idx}",
                "source_file": f"{title}.txt",
                "text": c,
            })

    if not kb_chunks:
        print("[DATA_SYNC] Không có chính sách nào trong DynamoDB để đồng bộ.")
        return

    embeddings = embed_texts([c["text"] for c in kb_chunks])
    for c, emb in zip(kb_chunks, embeddings):
        c["embedding"] = [round(x, 6) for x in emb]

    meta = {
        "model": EMBED_MODEL,
        "dim": EMBED_DIM,
        "built_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "source": "StorePolicies_Replica_CDC",
    }
    payload = {"meta": meta, "items": kb_chunks}
    s3.put_object(
        Bucket=VECTOR_BUCKET,
        Key="vectors/kb.json",
        Body=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        ContentType="application/json",
    )
    print(f"[DATA_SYNC] Đã đồng bộ {len(kb_chunks)} đoạn chính sách lên s3://{VECTOR_BUCKET}/vectors/kb.json")


def sync_products():
    print(f"[DATA_SYNC] Bắt đầu đồng bộ danh mục sản phẩm từ {PRODUCTS_TABLE}...")
    table = dynamodb.Table(PRODUCTS_TABLE)
    resp = table.scan()
    products = resp.get("Items", [])

    prods_payload = []
    texts_to_embed = []
    for p in products:
        pid = p.get("ProductID")
        name = p.get("name", "")
        price = int(p.get("price", 0))
        stock = int(p.get("stock", 0))
        image_url = p.get("image_url", "")
        compatible = p.get("compatible_models", [])
        desc = p.get("description", "")
        category = p.get("category", "")
        brand = p.get("brand", "")

        compatible_str = ", ".join(compatible) if isinstance(compatible, list) else str(compatible)
        search_text = (
            f"Tên: {name}. Thương hiệu: {brand}. Danh mục: {category}. "
            f"Giá: {price:,} VND. Tồn kho: {stock}. "
            f"Lắp vừa các xe: {compatible_str}. Mô tả: {desc}"
        )

        d = {
            "ProductID": pid,
            "name": name,
            "price": price,
            "stock": stock,
            "image_url": image_url,
            "compatible_models": compatible,
            "description": desc,
            "category": category,
            "brand": brand,
            "search_text": search_text,
        }
        prods_payload.append(d)
        texts_to_embed.append(search_text)

    if not prods_payload:
        print("[DATA_SYNC] Không có sản phẩm nào trong DynamoDB.")
        return

    embeddings = embed_texts(texts_to_embed)
    for d, emb in zip(prods_payload, embeddings):
        d["embedding"] = [round(x, 6) for x in emb]

    meta = {
        "model": EMBED_MODEL,
        "dim": EMBED_DIM,
        "built_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "source": "Products_Replica_CDC",
    }
    payload = {"meta": meta, "items": prods_payload}
    s3.put_object(
        Bucket=VECTOR_BUCKET,
        Key="vectors/products.json",
        Body=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        ContentType="application/json",
    )
    print(f"[DATA_SYNC] Đã đồng bộ {len(prods_payload)} sản phẩm lên s3://{VECTOR_BUCKET}/vectors/products.json")


def lambda_handler(event, context):
    """
    Kích hoạt bởi DynamoDB Streams hoặc gọi thủ công (warmup/re-index)
    """
    records = event.get("Records", [])
    if not records:
        # Nếu gọi thủ công không qua Stream: đồng bộ cả 2
        print("[DATA_SYNC] Kích hoạt đồng bộ toàn bộ (Manual trigger)...")
        sync_store_policies()
        sync_products()
        return {"statusCode": 200, "body": "full_sync_completed"}

    has_policy_change = False
    has_product_change = False

    for rec in records:
        source_arn = rec.get("eventSourceARN", "")
        if "StorePolicies" in source_arn:
            has_policy_change = True
        elif "Products" in source_arn:
            has_product_change = True

    if has_policy_change:
        sync_store_policies()

    if has_product_change:
        sync_products()

    return {"statusCode": 200, "body": "stream_sync_completed"}
