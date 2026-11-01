# chat_orchestrator_v2.py - Bản KHÔNG dùng OpenSearch Serverless và KHÔNG nạp model bge-m3 trong Lambda.
# Khác bản cũ: (1) embedding bằng Gemini (gemini-embedding-001, 768 chiều); (2) vector của kb và sản phẩm nằm trong
# file JSON trên S3, nạp vào bộ nhớ Lambda và tìm bằng cosine + BM25; (3) khóa Gemini đọc từ SSM Parameter Store
# (có cache, rơi về Secrets Manager); (4) giới hạn độ dài câu hỏi và tần suất; (5) user_id có thể lấy từ authorizer.
# Phần còn lại (Gemini orchestration, giỏ hàng, chuyển nhân viên, lịch sử, Garage) giữ nguyên bản cũ.
import json
import math
import os
import re
import time
import unicodedata
from decimal import Decimal

import boto3
from botocore.exceptions import ClientError

REGION = os.getenv("AWS_REGION", "ap-southeast-1")
SECRET_NAME = os.getenv("SECRET_NAME", "chatbot/geminiflash3")
SESSION_TABLE = os.getenv("SESSION_TABLE", "chatbot-sessions")
USERS_TABLE = os.getenv("USERS_TABLE", "Users")
CARTS_TABLE = os.getenv("CARTS_TABLE", "Carts")
PRODUCTS_TABLE = os.getenv("PRODUCTS_TABLE", "Products")
# Kho vector: hai file JSON do build_vector_snapshot tạo ra
VECTOR_BUCKET = os.getenv("VECTOR_BUCKET", "team-chatbot-kb-dev-999")
VECTOR_PREFIX = os.getenv("VECTOR_PREFIX", "vectors/")
KB_VECTOR_KEY = VECTOR_PREFIX + os.getenv("KB_VECTOR_FILE", "kb.json")
PRODUCT_VECTOR_KEY = VECTOR_PREFIX + os.getenv("PRODUCT_VECTOR_FILE", "products.json")
VECTOR_TTL_S = float(os.getenv("VECTOR_TTL_S", "300"))      # sau bao lâu thì kiểm tra lại S3 (ETag) xem có bản mới không
EMBED_MODEL = os.getenv("EMBED_MODEL", "gemini-embedding-001")
EMBED_DIM = int(os.getenv("EMBED_DIM", "768"))
EMBED_TIMEOUT_MS = int(os.getenv("EMBED_TIMEOUT_MS", "10000"))
# Khóa Gemini: ưu tiên SSM Parameter Store (SecureString, miễn phí), rơi về Secrets Manager nếu không đọc được
GEMINI_SSM_PARAM = os.getenv("GEMINI_SSM_PARAM", "")        # ví dụ /chatbot/gemini_api_key
KEY_TTL_S = float(os.getenv("KEY_TTL_S", "900"))
# Giới hạn chống lạm dụng và chi phí
MAX_QUESTION_CHARS = int(os.getenv("MAX_QUESTION_CHARS", "500"))
# 1: không tìm thấy gì thì tự tạo ticket cho nhân viên (hành vi cũ). 0: chỉ báo ngoài phạm vi, ticket chỉ tạo khi khách yêu cầu.
AUTO_HANDOVER_NO_HITS = os.getenv("AUTO_HANDOVER_NO_HITS", "0") == "1"
RL_SESSION_PER_MIN = int(os.getenv("RL_SESSION_PER_MIN", "8"))
RL_CONNECTION_PER_MIN = int(os.getenv("RL_CONNECTION_PER_MIN", "12"))
RL_GLOBAL_PER_DAY = int(os.getenv("RL_GLOBAL_PER_DAY", "2000"))
# client: tin user_id do client gửi (như bản cũ). authorizer: lấy user_id từ Lambda authorizer của $connect, bỏ qua body.
AUTH_MODE = os.getenv("AUTH_MODE", "client")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")
# Model dự phòng khi model chính quá tải (503/429). Để trống nếu không dùng.
GEMINI_FALLBACK_MODEL = os.getenv("GEMINI_FALLBACK_MODEL", "")
GEMINI_TIMEOUT_MS = int(os.getenv("GEMINI_TIMEOUT_MS", "10000"))  # tối đa cho MỖI lần gọi
GEMINI_RETRIES = int(os.getenv("GEMINI_RETRIES", "1"))
# Ngân sách thời gian TỔNG cho mọi lần gọi Gemini trong một câu hỏi (giây). Hết ngân sách thì
# dừng thử model tiếp theo và trả câu trả lời dự phòng, thay vì cộng dồn timeout của từng model.
GEMINI_BUDGET_S = float(os.getenv("GEMINI_BUDGET_S", "20"))
# Gemini từ chối thời hạn (deadline) dưới 10 giây: "Minimum allowed deadline is 10s" (lỗi 400).
# Vì vậy mỗi lần gọi luôn có thời hạn >= mức này, và chỉ bắt đầu lần gọi mới khi ngân sách còn đủ.
GEMINI_MIN_DEADLINE_MS = int(os.getenv("GEMINI_MIN_DEADLINE_MS", "10000"))
GEMINI_MIN_ATTEMPT_S = max(float(os.getenv("GEMINI_MIN_ATTEMPT_S", "10")), GEMINI_MIN_DEADLINE_MS / 1000)
# Ngắt mạch: model vừa lỗi quá tải (429/5xx) sẽ được bỏ qua trong khoảng này (giây)
GEMINI_COOLDOWN_S = float(os.getenv("GEMINI_COOLDOWN_S", "45"))

# Hai chỉ mục có thang điểm khác nhau, nên ngưỡng tách riêng.
# Xem log CloudWatch ("Search ...") để chỉnh lại cho phù hợp.
# LƯU Ý: thang điểm đã đổi (cosine thuần, không còn điểm của OpenSearch), nên hai ngưỡng này PHẢI hiệu chỉnh lại
# bằng bước cuối của build_vector_snapshot. KB_MIN_KW và PRODUCT_MIN_KW chỉ dùng khi không embed được (chỉ tìm từ khóa).
KB_MIN_SCORE = float(os.getenv("KB_MIN_SCORE", "0.55"))
PRODUCT_MIN_SCORE = float(os.getenv("PRODUCT_MIN_SCORE", "0.45"))
KB_MIN_KW = float(os.getenv("KB_MIN_KW", "0.4"))
PRODUCT_MIN_KW = float(os.getenv("PRODUCT_MIN_KW", "0.35"))

secrets = boto3.client("secretsmanager", region_name=REGION)
ssm = boto3.client("ssm", region_name=REGION)
s3 = boto3.client("s3", region_name=REGION)
dynamodb = boto3.resource("dynamodb", region_name=REGION)
session_table = dynamodb.Table(SESSION_TABLE)
users_table = dynamodb.Table(USERS_TABLE)
cart_table = dynamodb.Table(CARTS_TABLE)
products_table = dynamodb.Table(PRODUCTS_TABLE)
events_client = boto3.client("events", region_name=REGION)
EVENT_BUS = os.getenv("EVENT_BUS", "default")
# Mỗi phiên chỉ gửi 1 yêu cầu chuyển nhân viên trong khoảng này (giây), tránh spam email
HANDOVER_COOLDOWN = int(os.getenv("HANDOVER_COOLDOWN", "600"))

SYSTEM_PROMPT = """Bạn là nhân viên tư vấn của cửa hàng phụ tùng xe máy.
Chỉ trả lời dựa trên phần "Sản phẩm" và "Chính sách" được cung cấp, không tự bịa thông tin.
Quy tắc tư vấn phụ tùng:
- Khi biết xe của khách (khách nói hoặc có trong Garage), đối chiếu "Lắp vừa xe" của sản phẩm với xe và năm sản xuất đó.
  Nếu không có trong danh sách tương thích, nói rõ là không phù hợp, không tư vấn mua.
- Khách hỏi giá, tồn kho hoặc thông tin sản phẩm mà chưa nói xe: trả lời ngay sản phẩm tìm được (tên, giá, tồn kho, dòng xe lắp vừa).
  Không từ chối trả lời chỉ vì thiếu thông tin xe; cuối câu có thể mời khách cho biết dòng xe để xác nhận.
- Khách đã nói dòng xe nhưng chưa nói năm: vẫn gợi ý sản phẩm lắp vừa dòng xe đó, nhắc khách đối chiếu năm nếu danh sách ghi đời cụ thể.
- Khách muốn mua hoặc thêm vào giỏ mà chưa biết xe, và sản phẩm không phải loại Universal: hỏi dòng xe và năm sản xuất trước.
- Sản phẩm ghi "Universal" hoặc lắp mọi dòng xe thì không cần hỏi xe, kể cả khi thêm vào giỏ.
- Với câu hỏi về sản phẩm, không chèn nội dung tài liệu hướng dẫn hay chính sách (trừ khi khách hỏi về chúng).
- Giá và tồn kho chỉ lấy từ dữ liệu cung cấp. Nếu hết hàng, nói rõ và gợi ý sản phẩm thay thế (nếu có).
- Khi gợi ý, nêu tên sản phẩm, giá (VND) và tình trạng còn hàng.
Nếu không đủ thông tin, nói mình chưa tìm thấy và khuyên liên hệ hotline.
Trả lời tiếng Việt, ngắn gọn, xưng "mình", gọi khách là "bạn".
Với câu hỏi về chính sách, cuối câu ghi nguồn bằng tên file.
Quy tắc giỏ hàng:
- Chỉ gọi add_to_cart khi khách yêu cầu rõ ràng (ví dụ "thêm vào giỏ", "mua cái này") và đã rõ sản phẩm nào.
  Nếu còn mơ hồ (nhiều sản phẩm, chưa rõ số lượng) thì hỏi lại trước khi gọi.
- Chỉ dùng ProductID có trong phần "Sản phẩm". Không tự bịa mã.
- Không thêm vào giỏ sản phẩm không lắp vừa xe của khách (sản phẩm Universal lắp vừa mọi xe).
- Số lượng thêm vào giỏ phải đúng con số khách nói. Nếu công cụ từ chối (vượt tồn kho hoặc quá 10), chỉ báo lý do và hỏi lại khách, tuyệt đối không tự giảm số lượng rồi thêm.
- Sau khi gọi công cụ, báo kết quả dựa đúng trên kết quả công cụ trả về (kể cả khi báo lỗi).
Quy tắc chuyển nhân viên:
- Gọi request_human_agent khi khách muốn gặp nhân viên hoặc người thật, khiếu nại, tỏ ra bực bức,
  hoặc vấn đề mình không thể giải quyết bằng dữ liệu hiện có (ví dụ lỗi đơn hàng, yêu cầu bảo hành).
- Không gọi chỉ vì câu hỏi bình thường mà mình trả lời được.
- Sau khi gọi, báo cho khách đã chuyển yêu cầu và nêu mã yêu cầu (ticket_id) lấy từ kết quả công cụ.
  Nếu kết quả cho biết đã chuyển trước đó thì nói nhân viên đã nhận yêu cầu và sẽ phản hồi sớm.
"""

_model_down = {}      # Ngắt mạch Gemini: tên model -> thời điểm (epoch) được thử lại. Lưu theo từng instance Lambda.
_key_cache = {"value": None, "t": 0.0}
_embed_client = {"key": None, "client": None}


def get_api_key(force=False):
    """Khóa Gemini. Cache trong instance để không gọi SSM/Secrets Manager ở mỗi câu hỏi."""
    now = time.time()
    if not force and _key_cache["value"] and now - _key_cache["t"] < KEY_TTL_S:
        return _key_cache["value"]
    key = None
    if GEMINI_SSM_PARAM:
        try:
            key = ssm.get_parameter(Name=GEMINI_SSM_PARAM, WithDecryption=True)["Parameter"]["Value"].strip()
        except Exception as exc:
            print("Khong doc duoc SSM, thu Secrets Manager:", str(exc)[:150])
    if not key:
        value = secrets.get_secret_value(SecretId=SECRET_NAME)
        key = json.loads(value["SecretString"])["GEMINI_API_KEY"]
    _key_cache["value"], _key_cache["t"] = key, now
    return key


# ---------- Embedding bằng Gemini ----------
def _normalize(vec):
    norm = math.sqrt(math.sumprod(vec, vec))
    return [x / norm for x in vec] if norm else list(vec)


def _get_embed_client(api_key):
    if _embed_client["client"] is None or _embed_client["key"] != api_key:
        from google import genai
        from google.genai import types
        _embed_client["client"] = genai.Client(
            api_key=api_key, http_options=types.HttpOptions(timeout=EMBED_TIMEOUT_MS))
        _embed_client["key"] = api_key
    return _embed_client["client"]


def embed_query(text):
    """Vector đã chuẩn hóa của câu hỏi, hoặc None nếu Gemini lỗi (khi đó chỉ tìm bằng từ khóa)."""
    from google.genai import types
    for attempt in range(2):
        try:
            client = _get_embed_client(get_api_key())
            r = client.models.embed_content(
                model=EMBED_MODEL, contents=[text],
                config=types.EmbedContentConfig(task_type="RETRIEVAL_QUERY", output_dimensionality=EMBED_DIM))
            return _normalize(r.embeddings[0].values)
        except Exception as exc:
            code = getattr(exc, "code", None)
            print(f"Embed loi (lan {attempt + 1}): code={code} {str(exc)[:150]}")
            if code in (401, 403):
                _key_cache["value"] = None
            if code not in (429, 500, 502, 503, 504):
                break
            time.sleep(0.5)
    return None


# ---------- Tìm kiếm từ khóa (BM25), không phân biệt dấu ----------
def _fold(text):
    text = unicodedata.normalize("NFD", text.lower().replace("đ", "d"))
    return "".join(c for c in text if unicodedata.category(c) != "Mn")


# Từ dừng tiếng Việt (đã bỏ dấu): bỏ khỏi tìm kiếm từ khóa để câu ngoài phạm vi không "khớp" nhờ các từ phổ biến
_STOP = set("""la va cua co khong nhung cac mot nhu the nao gi thi ma o tai cho voi duoc bi nay do kia nen
de khi neu se da dang rat qua hay hoac vi sao bao nhieu may nhat hon trong ngoai tren duoi toi ban minh em anh chi
hom nay ngay viet bai ve ra vao len xuong lam muon can biet hoi xin cam on shop""".split())


def tokenize(text):
    words = [w for w in re.findall(r"\w+", _fold(text)) if w not in _STOP]
    return words + [a + "_" + b for a, b in zip(words, words[1:])]


class VectorStore:
    """Kho vector trong bộ nhớ, nạp từ một file JSON trên S3. Tự kiểm tra lại ETag mỗi VECTOR_TTL_S giây,
    nên cập nhật sản phẩm hoặc tài liệu chỉ cần ghi đè file trên S3, không phải deploy lại Lambda."""

    def __init__(self, key, weighted_field=None):
        self.key = key
        self.weighted_field = weighted_field   # trường được tính gấp đôi trong BM25 (tên sản phẩm)
        self.items, self.etag, self.loaded_at = [], None, 0.0
        self.df, self.avg_len = {}, 1.0

    def refresh(self, force=False):
        now = time.time()
        if self.items and not force and now - self.loaded_at < VECTOR_TTL_S:
            return
        try:
            etag = s3.head_object(Bucket=VECTOR_BUCKET, Key=self.key)["ETag"]
            if self.items and etag == self.etag:
                self.loaded_at = now
                return
            t = time.time()
            data = json.loads(s3.get_object(Bucket=VECTOR_BUCKET, Key=self.key)["Body"].read())
            self._index(data["items"])
            self.etag, self.loaded_at = etag, now
            print(f"TIMING vector_load {self.key}: {time.time() - t:.2f}s ({len(self.items)} muc)")
        except Exception as exc:
            if not self.items:
                raise
            print("Khong lam moi duoc kho vector, dung ban cu:", str(exc)[:150])
            self.loaded_at = now

    def _index(self, items):
        df, total = {}, 0
        for it in items:
            text = it.get("search_text") or it.get("text", "")
            toks = tokenize(text)
            if self.weighted_field and it.get(self.weighted_field):
                toks += tokenize(str(it[self.weighted_field]))
            it["_tf"] = {}
            for tk in toks:
                it["_tf"][tk] = it["_tf"].get(tk, 0) + 1
            it["_len"] = len(toks)
            total += len(toks)
            for tk in it["_tf"]:
                df[tk] = df.get(tk, 0) + 1
        self.items, self.df = items, df
        self.avg_len = (total / len(items)) if items else 1.0

    def bm25(self, question):
        """Điểm BM25 của từng mục, đã chuẩn hóa về 0-1 theo cùng cách bản cũ (min(điểm, 10) / 10)."""
        q = set(tokenize(question))
        n, k1, b = len(self.items), 1.5, 0.75
        out = []
        for it in self.items:
            s = 0.0
            for tk in q:
                f = it["_tf"].get(tk)
                if not f:
                    continue
                idf = math.log(1 + (n - self.df[tk] + 0.5) / (self.df[tk] + 0.5))
                s += idf * f * (k1 + 1) / (f + k1 * (1 - b + b * it["_len"] / self.avg_len))
            out.append(min(s, 10.0) / 10.0)
        return out

    def cosine(self, vec):
        return [math.sumprod(vec, it["embedding"]) for it in self.items]


_kb_store = VectorStore(KB_VECTOR_KEY)
_product_store = VectorStore(PRODUCT_VECTOR_KEY, weighted_field="name")


def to_native(obj):
    """Chuyển Decimal của DynamoDB sang int/float để json.dumps được."""
    if isinstance(obj, Decimal):
        return int(obj) if obj == obj.to_integral_value() else float(obj)
    if isinstance(obj, dict):
        return {k: to_native(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [to_native(v) for v in obj]
    return obj


# ---------- Lịch sử hội thoại ----------
def load_history(session_id):
    try:
        item = session_table.get_item(Key={"session_id": session_id}).get("Item", {})
    except ClientError as exc:
        print("Khong doc duoc session:", exc)
        return []
    return item.get("messages", [])


def save_history(session_id, messages):
    # update_item để không xóa các thuộc tính khác của phiên (vd handover_at)
    session_table.update_item(
        Key={"session_id": session_id},
        UpdateExpression="SET messages = :m",
        ExpressionAttributeValues={":m": messages[-6:]},
    )


# ---------- Chuyển cho nhân viên (EventBridge -> SNS) ----------
def claim_handover(session_id):
    """True nếu được phép gửi yêu cầu mới; False nếu phiên này vừa gửi gần đây."""
    now = int(time.time())
    try:
        session_table.update_item(
            Key={"session_id": session_id},
            UpdateExpression="SET handover_at = :n",
            ConditionExpression="attribute_not_exists(handover_at) OR handover_at < :c",
            ExpressionAttributeValues={":n": now, ":c": now - HANDOVER_COOLDOWN},
        )
        return True
    except ClientError as exc:
        if exc.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return False
        raise


def notify_handover(session_id, user_id, question, reason):
    """Phát sự kiện HumanHandoverRequested. Trả về ticket_id, hoặc None nếu đã gửi gần đây."""
    if not claim_handover(session_id):
        return None
    ticket_id = "HO_" + time.strftime("%Y%m%d%H%M%S", time.gmtime()) + "_" + os.urandom(2).hex()
    history_text = " | ".join(load_history(session_id))[-1500:]
    detail = {
        "ticket_id": ticket_id,
        "session_id": session_id,
        "user_id": user_id or "khach-chua-dang-nhap",
        "reason": reason,
        "question": question,
        "history_text": history_text,
    }
    events_client.put_events(Entries=[{
        "Source": "chatbot.orchestrator",
        "DetailType": "HumanHandoverRequested",
        "Detail": json.dumps(detail, ensure_ascii=False),
        "EventBusName": EVENT_BUS,
    }])
    print("Handover:", ticket_id, reason)
    return ticket_id


# ---------- Garage của khách ----------
def load_garage(user_id):
    """Trả về chuỗi mô tả xe trong Garage, hoặc "" nếu không có."""
    if not user_id:
        return ""
    try:
        item = users_table.get_item(Key={"UserID": user_id}).get("Item", {})
    except ClientError as exc:
        print("Khong doc duoc user:", exc)
        return ""
    lines = []
    for v in to_native(item.get("garage", [])):
        tag = " (xe chính)" if v.get("is_primary") else ""
        lines.append(f"- {v.get('brand', '')} {v.get('model', '')} đời {v.get('year', '')}{tag}")
    return "\n".join(lines)


# ---------- Tìm kiếm ----------
def search_kb(question, vector, k=3):
    """Có vector: xếp theo cosine, lọc theo KB_MIN_SCORE. Không có vector (Gemini embedding lỗi): xếp theo BM25."""
    _kb_store.refresh()
    if vector is not None:
        scores, floor = _kb_store.cosine(vector), KB_MIN_SCORE
    else:
        scores, floor = _kb_store.bm25(question), KB_MIN_KW
    order = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)[:k]
    return [{"score": scores[i], "text": _kb_store.items[i].get("text", ""),
             "source_file": _kb_store.items[i].get("source_file", ""),
             "chunk_id": _kb_store.items[i].get("chunk_id", "")}
            for i in order if scores[i] >= floor]


PRODUCT_FIELDS = ["ProductID", "name", "price", "stock", "image_url", "compatible_models", "description", "category", "brand"]


def search_products(question, vector, k=3):
    """Hybrid: 70% cosine + 30% từ khóa (BM25). Không có vector thì chỉ dùng từ khóa."""
    _product_store.refresh()
    kw = _product_store.bm25(question)
    if vector is not None:
        cos = _product_store.cosine(vector)
        scores, floor = [0.7 * c + 0.3 * w for c, w in zip(cos, kw)], PRODUCT_MIN_SCORE
    else:
        scores, floor = kw, PRODUCT_MIN_KW
    order = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)[:k]
    out = []
    for i in order:
        if scores[i] < floor:
            continue
        it = _product_store.items[i]
        out.append({**{f: it.get(f) for f in PRODUCT_FIELDS if f in it}, "score": scores[i]})
    return out


# ---------- Giới hạn tần suất (DynamoDB, dùng bảng chatbot-sessions) ----------
def _bump(scope, window, ttl):
    """Tăng bộ đếm nguyên tử cho (scope, window) và trả về giá trị mới."""
    resp = session_table.update_item(
        Key={"session_id": f"rl#{scope}#{window}"},
        UpdateExpression="ADD cnt :one SET expires_at = :e",
        ExpressionAttributeValues={":one": 1, ":e": int(time.time()) + ttl},
        ReturnValues="UPDATED_NEW")
    return int(resp["Attributes"]["cnt"])


def check_rate_limit(session_id, connection_id):
    """Trả về chuỗi thông báo nếu vượt giới hạn, ngược lại None. Lỗi DynamoDB thì cho qua (không chặn khách)."""
    minute = int(time.time() // 60)
    day = time.strftime("%Y%m%d", time.gmtime())
    try:
        if _bump("day", day, 2 * 86400) > RL_GLOBAL_PER_DAY:
            return "Hôm nay chatbot đã đạt giới hạn số câu hỏi. Bạn vui lòng quay lại vào ngày mai hoặc liên hệ hotline CSKH."
        if _bump("s:" + session_id[:80], minute, 180) > RL_SESSION_PER_MIN:
            return "Bạn gửi câu hỏi hơi nhanh, vui lòng đợi khoảng một phút rồi thử lại nhé."
        if _bump("c:" + connection_id, minute, 180) > RL_CONNECTION_PER_MIN:
            return "Bạn gửi câu hỏi hơi nhanh, vui lòng đợi khoảng một phút rồi thử lại nhé."
    except ClientError as exc:
        print("Khong kiem tra duoc gioi han tan suat (cho qua):", exc)
    return None


def resolve_user_id(event, body):
    """AUTH_MODE=authorizer: lấy user_id từ Lambda authorizer của $connect, bỏ qua user_id trong body (chống giả mạo)."""
    if AUTH_MODE == "authorizer":
        auth = (event.get("requestContext") or {}).get("authorizer") or {}
        return auth.get("user_id") or None      # khách (không token) -> None, như bản cũ
    return body.get("user_id")


def refresh_stock(products):
    """Lấy tồn kho và giá mới nhất từ DynamoDB (index có thể cũ)."""
    if not products:
        return products
    keys = [{"ProductID": p["ProductID"]} for p in products]
    try:
        resp = dynamodb.batch_get_item(RequestItems={PRODUCTS_TABLE: {
            "Keys": keys, "ProjectionExpression": "ProductID, stock, price, #s",
            "ExpressionAttributeNames": {"#s": "status"}}})
        fresh = {i["ProductID"]: to_native(i) for i in resp["Responses"].get(PRODUCTS_TABLE, [])}
    except ClientError as exc:
        print("Khong doc duoc ton kho:", exc)
        return products
    for p in products:
        f = fresh.get(p["ProductID"])
        if f:
            p["stock"] = f.get("stock", p.get("stock"))
            p["price"] = f.get("price", p.get("price"))
            p["status"] = str(f.get("status", "active")).lower()
    return products


# ---------- Giỏ hàng: đọc trực tiếp, không cần AI ----------
def read_cart(user_id):
    if not user_id:
        return {"ok": False, "error": "Khách chưa đăng nhập, cần đăng nhập để dùng giỏ hàng."}
    try:
        cart = cart_table.get_item(Key={"CartID": user_id}).get("Item")
    except ClientError as exc:
        print("Loi doc gio hang:", exc)
        return {"ok": False, "error": "Hệ thống giỏ hàng đang gặp lỗi, vui lòng thử lại sau."}
    if not cart or not cart.get("items"):
        return {"ok": True, "items": [], "subtotal_vnd": 0}
    items = [{"name": i["name"], "price": i["price"], "quantity": i["quantity"]} for i in cart["items"]]
    return to_native({"ok": True, "items": items, "subtotal_vnd": cart.get("subtotal", 0)})


# Từ chỉ hành động thay đổi giỏ: gặp là KHÔNG dùng đường nhanh, để Gemini xử lý
CART_ACTION_WORDS = ("thêm", "bỏ vào", "cho vào", "bỏ ra", "mua", "đặt", "xóa", "xoá", "bớt",
                     "giảm", "tăng", "thanh toán", "đổi")
CART_VIEW_WORDS = ("xem", "kiểm tra", "coi", "có gì", "có những gì", "hiện tại", "của tôi",
                   "của mình", "tổng", "bao nhiêu")


def is_cart_view(question):
    """True nếu khách chỉ muốn XEM giỏ hàng (không thêm/xóa). Nhận dạng bằng từ khóa, thận trọng:
    nghi ngờ thì trả False để câu hỏi đi qua Gemini như bình thường."""
    q = question.lower()
    if "giỏ" not in q:
        return False
    if any(w in q for w in CART_ACTION_WORDS):
        return False
    return any(w in q for w in CART_VIEW_WORDS)


def money(n):
    return f"{int(n):,}".replace(",", ".")


def cart_view_answer(user_id):
    cart = read_cart(user_id)
    if not cart.get("ok"):
        return cart.get("error", "Chưa xem được giỏ hàng, bạn vui lòng thử lại sau.")
    if not cart["items"]:
        return "Giỏ hàng của bạn đang trống."
    lines = [f"- {i['name']} x {i['quantity']}: {money(int(i['price']) * int(i['quantity']))} VND"
             for i in cart["items"]]
    return "Giỏ hàng của bạn hiện có:\n" + "\n".join(lines) + f"\nTạm tính: {money(cart['subtotal_vnd'])} VND."


# ---------- Gemini ----------
def product_mentioned(prod, context_text):
    """Kiểm tra khách (hoặc bot) đã nhắc tới sản phẩm này trong hội thoại gần đây chưa.
    Dùng làm chốt chặn cứng: tránh thêm nhầm sản phẩm khi khách nói chung chung ("cái đó")
    mà hội thoại không có sản phẩm nào được nhắc tới."""
    import re
    ctx = context_text.lower()
    if str(prod.get("ProductID", "")).lower() in ctx:
        return True
    # Bỏ các từ chung chung / tên xe: khách nhắc "Exciter 150" chưa có nghĩa là đã chọn sản phẩm này
    stop = {"trước", "sau", "cho", "xe", "yamaha", "honda", "suzuki", "exciter", "150", "125", "110"}
    words = [w for w in re.findall(r"\w+", str(prod.get("name", "")).lower()) if len(w) > 2 and w not in stop]
    if not words:
        return True
    ctx_words = set(re.findall(r"\w+", ctx))
    hit = sum(1 for w in words if w in ctx_words)
    return hit >= 1 and hit / len(words) >= 0.25


def recent_product_ids(last_bot_text):
    """Lấy danh sách ProductID trong thẻ "[Sản phẩm đã nhắc: ID = tên; ID = tên]" của lượt bot gần nhất."""
    import re
    m = re.search(r"\[Sản phẩm đã nhắc:\s*(.*?)\]", last_bot_text or "")
    if not m:
        return []
    ids = []
    for part in m.group(1).split(";"):
        pid = part.split("=")[0].strip()
        if pid and pid not in ids:
            ids.append(pid)
    return ids


def make_cart_tools(user_id, state, context_text="", question_text="", last_bot_text=""):
    """Tạo các hàm công cụ cho Gemini. user_id lấy từ phiên, Gemini không được tự chọn."""
    qty_refused = set()   # sản phẩm đã bị từ chối vì số lượng trong lượt này: không cho Gemini thử lại số khác

    def add_to_cart(product_id: str, quantity: int = 1) -> dict:
        """Thêm một sản phẩm vào giỏ hàng của khách. Chỉ gọi khi khách yêu cầu rõ ràng.

        Args:
            product_id: Mã sản phẩm (ProductID) trong danh sách Sản phẩm, ví dụ PROD_BRK_001.
            quantity: Số lượng đúng như khách nói, giữ nguyên con số của khách, kể cả khi lớn (công cụ tự kiểm tra tồn kho và giới hạn 10, không được tự giảm xuống).
        """
        if not user_id:
            return {"ok": False, "error": "Khách chưa đăng nhập, cần đăng nhập để dùng giỏ hàng."}
        quantity = int(quantity)
        if quantity < 1:
            return {"ok": False, "error": "Số lượng phải từ 1 trở lên."}
        try:
            prod = products_table.get_item(Key={"ProductID": product_id}).get("Item")
            if not prod or str(prod.get("status", "active")).lower() != "active":
                return {"ok": False, "error": "Không tìm thấy sản phẩm này hoặc sản phẩm đã ngừng bán."}
            if not product_mentioned(prod, context_text):
                return {"ok": False, "error": "Chưa rõ khách muốn thêm sản phẩm nào. "
                        "Hãy hỏi lại khách tên sản phẩm cụ thể, không tự chọn thay khách."}
            # Khách nói chung chung ("cái đó"): chỉ thêm khi lượt trả lời trước nhắc đúng MỘT sản phẩm
            # và đó chính là sản phẩm này. Nếu lượt trước liệt kê nhiều sản phẩm thì phải hỏi lại.
            if question_text and not product_mentioned(prod, question_text):
                if recent_product_ids(last_bot_text) != [product_id]:
                    return {"ok": False, "error": "Khách chưa nói rõ muốn thêm sản phẩm nào "
                            "(lượt trước có nhiều sản phẩm hoặc không rõ). Hãy hỏi lại khách "
                            "tên sản phẩm cụ thể, không tự chọn thay khách."}
            stock = int(prod.get("stock", 0))
            cart = cart_table.get_item(Key={"CartID": user_id}).get("Item") or {"CartID": user_id, "items": []}
            items = cart.get("items", [])
            current = next((i for i in items if i["product_id"] == product_id), None)
            new_qty = quantity + (int(current["quantity"]) if current else 0)
            if product_id in qty_refused:
                return {"ok": False, "error": "Yêu cầu số lượng cho sản phẩm này đã bị từ chối trong lượt này. "
                        "KHÔNG thử lại số lượng khác. Hãy hỏi khách muốn thêm bao nhiêu."}
            if new_qty > stock:
                qty_refused.add(product_id)
                return {"ok": False, "error": f"Kho chỉ còn {stock} sản phẩm (trong giỏ đang có {new_qty - quantity}). Báo khách số tồn kho và hỏi khách muốn thêm bao nhiêu, KHÔNG tự thêm số lượng khác."}
            if quantity > 10:
                qty_refused.add(product_id)
                return {"ok": False, "error": "Mỗi lần chỉ thêm tối đa 10 sản phẩm, hãy hỏi khách số lượng nhỏ hơn, KHÔNG tự thêm số lượng khác thay khách."}
            if current:
                current["quantity"] = new_qty
            else:
                items.append({
                    "product_id": product_id,
                    "name": prod["name"],
                    "price": prod["price"],
                    "quantity": new_qty,
                    "image_url": prod.get("image_url", ""),
                })
            cart["items"] = items
            cart["subtotal"] = sum(int(i["price"]) * int(i["quantity"]) for i in items)
            cart["updated_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            cart["expires_at"] = int(time.time()) + 14 * 86400
            cart_table.put_item(Item=cart)
        except ClientError as exc:
            print("Loi gio hang:", exc)
            return {"ok": False, "error": "Hệ thống giỏ hàng đang gặp lỗi, vui lòng thử lại sau."}
        state["cart_updated"] = True
        return {"ok": True, "product": prod["name"], "quantity_in_cart": new_qty,
                "subtotal_vnd": int(cart["subtotal"])}

    def get_cart() -> dict:
        """Xem các sản phẩm đang có trong giỏ hàng của khách và tổng tiền tạm tính."""
        return read_cart(user_id)

    return [add_to_cart, get_cart]


def make_handover_tools(session_id, user_id, question, state):
    """Công cụ chuyển cho nhân viên. session_id và user_id do code cung cấp."""

    def request_human_agent(reason: str) -> dict:
        """Chuyển cuộc trò chuyện cho nhân viên CSKH thật. Gọi khi khách muốn gặp người thật,
        khiếu nại, tỏ ra bực bức, hoặc vấn đề không thể giải quyết bằng dữ liệu hiện có.

        Args:
            reason: Lý do ngắn gọn cần nhân viên hỗ trợ (tiếng Việt).
        """
        try:
            ticket = notify_handover(session_id, user_id, question, reason[:300])
        except ClientError as exc:
            print("Loi chuyen nhan vien:", exc)
            return {"ok": False, "error": "Không gửi được yêu cầu, khách nên gọi hotline CSKH."}
        if ticket is None:
            return {"ok": True, "already_requested": True}
        state["handover_ticket"] = ticket
        return {"ok": True, "ticket_id": ticket}

    return [request_human_agent]


def answer_with_gemini(question, kb_hits, products, garage, past, user_id=None, state=None, session_id=None):
    from google import genai
    from google.genai import types
    state = state if state is not None else {}

    kb_ctx = "\n\n".join(f"[{i}] {h['source_file']}\n{h['text']}" for i, h in enumerate(kb_hits, 1))
    prod_ctx = "\n".join(
        f"- {p['ProductID']} | {p['name']} | {p.get('brand', '')} | {p.get('price', '?')} VND | "
        f"tồn kho: {p.get('stock', '?')} | Lắp vừa xe: {p.get('compatible_models', '')} | {p.get('description', '')}"
        for p in products
    )
    memory = "\n".join(past[-6:])
    prompt = (
        SYSTEM_PROMPT
        + "\n\nXe trong Garage của khách:\n" + (garage or "(chưa có)")
        + "\n\nHội thoại trước:\n" + memory
        + "\n\nCâu hỏi: " + question
        + "\n\nSản phẩm:\n" + (prod_ctx or "(không có)")
        + "\n\nChính sách:\n" + (kb_ctx or "(không có)")
    )
    api_key = get_api_key()
    last_bot = next((m for m in reversed(past) if m.startswith("Bot:")), "")
    tools = (make_cart_tools(user_id, state, memory + " " + question, question, last_bot)
             + make_handover_tools(session_id, user_id, question, state))
    config_kwargs = {"tools": tools}
    # Tùy chọn: giảm mức "suy nghĩ" của Gemini để trả lời nhanh hơn (minimal / low / medium / high).
    # Để trống thì không gửi tham số, giữ mặc định của model.
    thinking_level = os.getenv("GEMINI_THINKING_LEVEL", "").strip()
    if thinking_level:
        try:
            config_kwargs["thinking_config"] = types.ThinkingConfig(thinking_level=thinking_level)
        except Exception as exc:
            print("Khong dat duoc thinking_level:", exc)
    config = types.GenerateContentConfig(**config_kwargs)

    # Thử model chính (có thử lại ngắn khi quá tải), rồi model dự phòng nếu có cấu hình
    attempts = [(GEMINI_MODEL, n) for n in range(GEMINI_RETRIES)]
    # GEMINI_FALLBACK_MODEL có thể là một danh sách phân tách bằng dấu phẩy, thử lần lượt
    for fb in [m.strip() for m in GEMINI_FALLBACK_MODEL.split(",") if m.strip()]:
        attempts.append((fb, 0))
    # Ngắt mạch: bỏ qua model vừa lỗi quá tải gần đây. Nếu tất cả đang "nghỉ" thì vẫn dò lại model chính một lần.
    now = time.time()
    active = [a for a in attempts if _model_down.get(a[0], 0) <= now]
    if not active:
        active = attempts[:1]
        print("Tat ca model dang nghi, do lai model chinh")
    resting = sorted({a[0] for a in attempts if a not in active})
    if resting:
        print("Bo qua model dang nghi:", resting)
    deadline = now + GEMINI_BUDGET_S
    last_exc = None
    for model_name, n in active:
        # Nếu công cụ đã chạy (đã thêm giỏ hàng / đã chuyển nhân viên) thì KHÔNG gọi lại,
        # tránh thực hiện hành động hai lần.
        if state.get("cart_updated") or state.get("handover_ticket"):
            break
        remaining = deadline - time.time()
        if remaining < GEMINI_MIN_ATTEMPT_S:
            print(f"Het ngan sach thoi gian Gemini ({GEMINI_BUDGET_S:.0f}s), dung o {model_name}")
            break
        # Mỗi lần gọi chờ tối đa GEMINI_TIMEOUT_MS nhưng không vượt phần ngân sách còn lại
        call_ms = int(max(GEMINI_MIN_DEADLINE_MS, min(GEMINI_TIMEOUT_MS, remaining * 1000)))
        gemini = genai.Client(api_key=api_key, http_options=types.HttpOptions(timeout=call_ms))
        try:
            return gemini.models.generate_content(model=model_name, contents=prompt, config=config).text
        except Exception as exc:
            last_exc = exc
            code = getattr(exc, "code", None)
            print(f"Gemini loi ({model_name}, lan {n + 1}): code={code} {str(exc)[:200]}")
            if code in (401, 403):
                _key_cache["value"] = None     # khóa có thể vừa được xoay: lần sau đọc lại từ SSM/Secrets Manager
            if code not in (429, 500, 502, 503, 504):
                raise
            _model_down[model_name] = time.time() + GEMINI_COOLDOWN_S

    # Công cụ đã chạy nhưng không soạn được câu trả lời: báo kết quả thật cho khách
    if state.get("handover_ticket"):
        return (f"Mình đã chuyển yêu cầu của bạn cho nhân viên (mã yêu cầu {state['handover_ticket']}). "
                "Nhân viên sẽ phản hồi sớm.")
    if state.get("cart_updated"):
        return ("Mình đã thêm sản phẩm vào giỏ hàng của bạn nhưng hệ thống đang bận nên chưa soạn được "
                "chi tiết. Bạn vui lòng kiểm tra lại giỏ hàng nhé.")
    raise last_exc if last_exc else RuntimeError("Khong goi duoc Gemini")


def fallback_answer(question, products, kb_hits):
    """Câu trả lời khi không model AI nào dùng được: chỉ trình bày kết quả tìm kiếm, không tư vấn thay AI."""
    q = question.lower()
    action_words = ("giỏ", "thêm", "mua", "đặt", "nhân viên", "người thật", "khiếu nại")
    busy = "Hệ thống AI đang quá tải nên mình chưa trả lời đầy đủ được."
    if any(w in q for w in action_words):
        return busy + " Mình chưa thực hiện yêu cầu này, bạn vui lòng thử lại sau ít phút hoặc liên hệ hotline CSKH nhé."
    policy_words = ("bảo hành", "đổi trả", "hoàn tiền", "vận chuyển", "giao hàng", "phí ship", "miễn phí", "chính sách")
    kb_first = bool(kb_hits) and (
        any(w in q for w in policy_words)
        or not products
        or (kb_hits[0].get("score", 0) - KB_MIN_SCORE) > (products[0].get("score", 0) - PRODUCT_MIN_SCORE))
    if kb_first:
        h = kb_hits[0]
        return busy + f" Nội dung liên quan trong tài liệu {h['source_file']}:\n" + h["text"][:600]
    if products:
        lines = [
            f"- {p['name']} | {p.get('price', '?')} VND | tồn kho: {p.get('stock', '?')} | "
            f"Lắp vừa xe: {p.get('compatible_models', 'chưa rõ')}"
            for p in products[:3]
        ]
        return (busy + " Mình liệt kê nhanh các sản phẩm tìm được, bạn vui lòng đối chiếu dòng xe "
                "ở mục \"Lắp vừa xe\" trước khi mua:\n" + "\n".join(lines))
    if kb_hits:
        h = kb_hits[0]
        return busy + f" Nội dung liên quan trong tài liệu {h['source_file']}:\n" + h["text"][:400]
    return busy + " Bạn vui lòng thử lại sau ít phút hoặc liên hệ hotline CSKH."


# ---------- Handler ----------
def _handle(event, context):
    route = event.get("requestContext", {}).get("routeKey")
    if route in ("$connect", "$disconnect"):
        return {"statusCode": 200, "body": "ok"}

    body = event.get("body") or "{}"
    if isinstance(body, str):
        body = json.loads(body)
    question = (body.get("question") or "").strip()
    connection_id = event["requestContext"]["connectionId"]
    domain = event["requestContext"]["domainName"]
    stage = event["requestContext"]["stage"]
    session_id = body.get("session_id") or connection_id
    # AUTH_MODE=client: tạm thời tin user_id do client gửi. AUTH_MODE=authorizer: lấy từ authorizer của $connect (JWT Cognito).
    user_id = resolve_user_id(event, body)

    gateway = boto3.client(
        "apigatewaymanagementapi",
        endpoint_url=f"https://{domain}/{stage}",
        region_name=REGION,
    )

    def send(payload):
        gateway.post_to_connection(
            ConnectionId=connection_id,
            Data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        )

    if not question:
        send({"answer": "Thieu cau hoi"})
        return {"statusCode": 200, "body": "ok"}

    if len(question) > MAX_QUESTION_CHARS:
        send({"answer": f"Câu hỏi hơi dài, bạn vui lòng rút gọn dưới {MAX_QUESTION_CHARS} ký tự nhé.",
              "sources": [], "products": [], "low_confidence": False, "rate_limited": True})
        return {"statusCode": 200, "body": "ok"}
    limited = check_rate_limit(session_id, connection_id)
    if limited:
        send({"answer": limited, "sources": [], "products": [], "low_confidence": False, "rate_limited": True})
        return {"statusCode": 200, "body": "ok"}

    t0 = time.time()

    marks = [t0]

    def lap(label):
        # In thời gian cộng dồn từ đầu câu hỏi và thời gian riêng của bước vừa xong (+...)
        now = time.time()
        print(f"TIMING {label}: {now - t0:.1f}s (+{now - marks[-1]:.1f}s)")
        marks.append(now)

    # Đường nhanh: chỉ xem giỏ hàng thì đọc thẳng DynamoDB, không cần embedding, tìm kiếm hay Gemini.
    if is_cart_view(question):
        print("Fast path: xem gio hang")
        answer = cart_view_answer(user_id)
        past = load_history(session_id)
        past.extend([f"Khach: {question}", f"Bot: {answer}"])
        save_history(session_id, past)
        send({
            "answer": answer,
            "sources": [],
            "products": [],
            "low_confidence": False,
            "degraded": False,
            "cart_updated": False,
            "handover_ticket": None,
        })
        lap("total")
        return {"statusCode": 200, "body": "ok"}

    # Tùy chọn: client gửi "progress": true thì nhận ngay một tin trạng thái trước câu trả lời chính.
    # Mặc định tắt để không đổi cách client hiện tại đọc một phản hồi duy nhất.
    if body.get("progress"):
        try:
            send({"status": "processing"})
        except Exception as exc:
            print("Khong gui duoc tin trang thai:", exc)

    vector = embed_query(question)
    if vector is None:
        print("Khong embed duoc, tim kiem chi bang tu khoa")
    lap("embed")

    kb_hits = search_kb(question, vector)
    products = search_products(question, vector)
    print("Search KB:", [(h["chunk_id"], round(h["score"], 3)) for h in kb_hits])
    print("Search SP:", [(p["ProductID"], round(p["score"], 3)) for p in products])
    lap("search")

    if not kb_hits and not products:
        ticket = None
        if AUTO_HANDOVER_NO_HITS:
            try:
                ticket = notify_handover(session_id, user_id, question, "Chatbot không tìm thấy thông tin phù hợp")
            except ClientError as exc:
                print("Loi chuyen nhan vien:", exc)
        if not AUTO_HANDOVER_NO_HITS:
            answer = ("Mình chưa tìm thấy thông tin phù hợp cho câu hỏi này. Mình hỗ trợ tư vấn phụ tùng xe máy, "
                      "tra giá và tồn kho, giỏ hàng và các chính sách của cửa hàng (đổi trả, bảo hành, vận chuyển). "
                      "Nếu bạn cần nhân viên hỗ trợ, hãy nhắn \"gặp nhân viên\" nhé.")
        elif ticket:
            answer = (f"Mình chưa thấy nội dung này trong dữ liệu hiện có nên đã chuyển câu hỏi của bạn "
                      f"cho nhân viên (mã yêu cầu {ticket}). Nhân viên sẽ phản hồi sớm.")
        else:
            answer = ("Mình chưa thấy nội dung này trong dữ liệu hiện có. Yêu cầu của bạn đã được chuyển "
                      "cho nhân viên trước đó, vui lòng chờ phản hồi hoặc liên hệ hotline CSKH.")
        past = load_history(session_id)
        past.extend([f"Khach: {question}", f"Bot: {answer}"])
        save_history(session_id, past)
        send({
            "answer": answer,
            "sources": [],
            "products": [],
            "low_confidence": True,
            "handover_ticket": ticket,
        })
        return {"statusCode": 200, "body": "ok"}

    products = refresh_stock(products)
    garage = load_garage(user_id)
    past = load_history(session_id)
    lap("prep")
    state = {"cart_updated": False, "handover_ticket": None}
    degraded = False
    try:
        answer = answer_with_gemini(question, kb_hits, products, garage, past, user_id, state, session_id)
    except Exception as exc:
        # Mọi model Gemini đều lỗi: vẫn trả về kết quả tìm kiếm thay vì báo "hệ thống sự cố"
        print("Gemini that bai toan bo, dung cau tra loi du phong:", str(exc)[:200])
        answer = fallback_answer(question, products, kb_hits)
        degraded = True
    lap("gemini")

    # Chỉ hiển thị sản phẩm/nguồn mà câu trả lời thực sự nhắc tới (không phải toàn bộ kết quả tìm kiếm)
    answer_lower = answer.lower()
    shown_products = [p for p in products
                      if p["ProductID"].lower() in answer_lower or p["name"].lower() in answer_lower]

    # Lưu kèm mã sản phẩm đã nhắc vào lịch sử: lượt sau khách nói "cái đó" thì model biết đúng ProductID,
    # không phải đoán mã (đoán sai sẽ báo "không tìm thấy sản phẩm")
    history_answer = answer
    if shown_products:
        history_answer += " [Sản phẩm đã nhắc: " + "; ".join(
            f"{p['ProductID']} = {p['name']}" for p in shown_products) + "]"
    past.extend([f"Khach: {question}", f"Bot: {history_answer}"])
    save_history(session_id, past)
    shown_sources = [] if state["handover_ticket"] else sorted(
        {h["source_file"] for h in kb_hits if h["source_file"].lower() in answer_lower})

    send({
        "answer": answer,
        "sources": shown_sources,
        "products": [
            {"ProductID": p["ProductID"], "name": p["name"], "price": p.get("price"),
             "stock": p.get("stock"), "image_url": p.get("image_url")}
            for p in shown_products
        ],
        "low_confidence": False,
        "degraded": degraded,
        "cart_updated": state["cart_updated"],
        "handover_ticket": state["handover_ticket"],
    })
    lap("total")
    return {"statusCode": 200, "body": "ok"}


def handler(event, context):
    """Bọc _handle: nếu có lỗi, ghi log và vẫn trả lời khách thay vì để client chờ đến timeout."""
    try:
        # Sự kiện định kỳ từ EventBridge Scheduler: nạp sẵn kho vector và thử Gemini embedding, không xử lý chat
        if isinstance(event, dict) and event.get("warmup"):
            t = time.time()
            _kb_store.refresh()
            _product_store.refresh()
            ok = embed_query("khởi động hệ thống") is not None
            print(f"TIMING warmup: {time.time() - t:.1f}s (embed_ok={ok})")
            return {"statusCode": 200, "body": "warm"}
        return _handle(event, context)
    except Exception:
        import traceback
        traceback.print_exc()
        if not (isinstance(event, dict) and "requestContext" in event):
            return {"statusCode": 500, "body": "error"}
        try:
            rc = event["requestContext"]
            gateway = boto3.client(
                "apigatewaymanagementapi",
                endpoint_url=f"https://{rc['domainName']}/{rc['stage']}",
                region_name=REGION,
            )
            gateway.post_to_connection(
                ConnectionId=rc["connectionId"],
                Data=json.dumps(
                    {"answer": "Hệ thống đang gặp sự cố, bạn vui lòng thử lại sau hoặc liên hệ hotline CSKH.",
                     "sources": [], "products": [], "low_confidence": True, "error": True},
                    ensure_ascii=False,
                ).encode("utf-8"),
            )
        except Exception:
            traceback.print_exc()
        return {"statusCode": 500, "body": "error"}
