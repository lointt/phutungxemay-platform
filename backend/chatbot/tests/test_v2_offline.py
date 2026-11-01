# Test offline cho v2: không cần AWS, không cần Gemini. Chạy: python tests/test_v2_offline.py
import importlib, json, os, sys, time, types, tempfile
from unittest import mock

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(ROOT, "src", "orchestrator"))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
sys.path.insert(0, os.path.join(ROOT, "src", "authorizer"))
os.environ.setdefault("AWS_DEFAULT_REGION", "ap-southeast-1")
passed = failed = 0


def check(name, cond, extra=""):
    global passed, failed
    if cond:
        passed += 1; print("  OK  ", name)
    else:
        failed += 1; print("  LỖI ", name, extra)


# ---- 1. Tạo snapshot bằng vector giả ----
import build_vector_snapshot as bvs
bvs.EMBED_DIM = 768
docs = os.path.join(tempfile.mkdtemp(), "kb"); os.makedirs(docs)
open(os.path.join(docs, "chinh_sach_bao_hanh.txt"), "w", encoding="utf-8").write(
    "CHÍNH SÁCH BẢO HÀNH\n\nThời hạn bảo hành: Phụ tùng chính hãng được bảo hành 6 tháng.\n\n"
    "Cách yêu cầu bảo hành: Khách nhắn qua chatbot kèm mã đơn hàng.")
open(os.path.join(docs, "chinh_sach_doi_tra.txt"), "w", encoding="utf-8").write(
    "CHÍNH SÁCH ĐỔI TRẢ\n\nThời gian đổi trả: Khách được đổi trả trong 7 ngày kể từ ngày nhận hàng.")
prods_file = os.path.join(tempfile.mkdtemp(), "p.json")
json.dump([
    {"ProductID": "P1", "name": "Bố thắng trước Exciter 150", "price": 120000, "stock": 5, "category": "Phanh",
     "brand": "Nissin", "compatible_models": ["Exciter 150"], "description": "Má phanh đĩa trước", "image_url": "x"},
    {"ProductID": "P2", "name": "Nhớt Motul 10W40", "price": 250000, "stock": 9, "category": "Nhớt",
     "brand": "Motul", "compatible_models": ["Wave Alpha"], "description": "Nhớt cho xe số"}], open(prods_file, "w"))
out = tempfile.mkdtemp()
ns = types.SimpleNamespace(docs_dir=docs, products_json=prods_file, fake_embed=True)
kb_doc, prod_doc = bvs.build(ns)
check("snapshot kb có 3 đoạn", len(kb_doc["items"]) == 3, len(kb_doc["items"]))
check("vector 768 chiều, đã chuẩn hóa", len(kb_doc["items"][0]["embedding"]) == 768 and
      abs(sum(x * x for x in kb_doc["items"][0]["embedding"]) - 1) < 1e-3)
check("snapshot sản phẩm có search_text", "Lắp vừa xe: Exciter 150" in prod_doc["items"][0]["search_text"])

# ---- 2. Orchestrator với S3/DynamoDB giả ----
class FakeS3:
    def __init__(self): self.objs = {}; self.heads = 0; self.gets = 0
    def put(self, key, doc): self.objs[key] = json.dumps(doc).encode()
    def head_object(self, Bucket, Key):
        self.heads += 1
        return {"ETag": str(hash(self.objs[Key]))}
    def get_object(self, Bucket, Key):
        self.gets += 1
        import io
        return {"Body": io.BytesIO(self.objs[Key])}

class FakeTable:
    def __init__(self): self.rows = {}
    def update_item(self, Key, UpdateExpression, ExpressionAttributeValues, ReturnValues):
        k = Key["session_id"]; self.rows[k] = self.rows.get(k, 0) + 1
        return {"Attributes": {"cnt": self.rows[k]}}

fake_s3 = FakeS3()
fake_s3.put("vectors/kb.json", kb_doc); fake_s3.put("vectors/products.json", prod_doc)
fake_table = FakeTable()

class FakeResource:
    def Table(self, name): return fake_table

def fake_client(name, **kw):
    return fake_s3 if name == "s3" else mock.MagicMock()

with mock.patch("boto3.client", fake_client), mock.patch("boto3.resource", lambda *a, **k: FakeResource()):
    orch = importlib.import_module("chat_orchestrator_v2")
orch.s3 = fake_s3
orch.session_table = fake_table
orch.VECTOR_BUCKET = "b"

# Vector truy vấn = vector của chính đoạn tài liệu -> cosine = 1
kb0 = kb_doc["items"][0]
hits = orch.search_kb("bất kỳ", kb0["embedding"])
check("search_kb: đúng đoạn đứng đầu", hits and hits[0]["chunk_id"] == kb0["chunk_id"] and hits[0]["score"] > 0.99)
check("search_kb: vector xa bị lọc theo ngưỡng", orch.search_kb("x", fake_vec := bvs.embed_documents(["không liên quan gì cả"], True)[0]) == [])
p_hits = orch.search_products("bố thắng exciter", prod_doc["items"][0]["embedding"])
check("search_products: có sản phẩm P1, giữ trường giá/tồn kho", p_hits and p_hits[0]["ProductID"] == "P1" and p_hits[0]["stock"] == 5)
kw = orch.search_products("bố thắng exciter 150", None)
check("search_products chỉ từ khóa (Gemini lỗi) vẫn ra P1", kw and kw[0]["ProductID"] == "P1", kw)

# ETag: trong TTL không gọi S3; hết TTL gọi head nhưng không tải lại khi ETag không đổi
gets_before, heads_before = fake_s3.gets, fake_s3.heads
orch.search_kb("a", kb0["embedding"])
check("trong TTL không gọi S3", fake_s3.heads == heads_before)
orch._kb_store.loaded_at = 0
orch.search_kb("a", kb0["embedding"])
check("hết TTL: head nhưng không tải lại khi ETag cũ", fake_s3.heads == heads_before + 1 and fake_s3.gets == gets_before)
new_doc = json.loads(json.dumps(kb_doc)); new_doc["items"].append({**kb0, "chunk_id": "moi#0", "text": "Đoạn mới"})
fake_s3.put("vectors/kb.json", new_doc); orch._kb_store.loaded_at = 0
orch.search_kb("a", kb0["embedding"])
check("ghi đè file trên S3 thì Lambda nhận bản mới", len(orch._kb_store.items) == 4)
# S3 lỗi sau khi đã nạp: dùng bản cũ
def boom(*a, **k): raise RuntimeError("s3 down")
fake_s3.head_object = boom; orch._kb_store.loaded_at = 0
check("S3 lỗi: dùng bản cũ, không văng lỗi", len(orch.search_kb("a", kb0["embedding"])) >= 1)

# Từ khóa trên bộ tài liệu thật (5 file, ~25 đoạn) để kiểm tra ngưỡng KB_MIN_KW
real = bvs.build(types.SimpleNamespace(docs_dir=os.path.join(ROOT, "data", "kb_docs"), products_json=prods_file, fake_embed=True))[0]
fake_s3.put("vectors/kb.json", real); fake_s3.head_object = FakeS3().head_object.__func__.__get__(fake_s3)
orch._kb_store.items = []; orch._kb_store.loaded_at = 0
for q, want in [("Phụ tùng được bảo hành bao lâu?", "chinh_sach_bao_hanh.txt"), ("Làm sao để yêu cầu bảo hành sản phẩm?", "chinh_sach_bao_hanh.txt"),
                ("Dấu hiệu phuộc bị hỏng là gì?", "huong_dan_chon_phu_tung.txt"), ("Xe côn tay nên dùng nhớt loại nào?", "huong_dan_chon_phu_tung.txt")]:
    h = orch.search_kb(q, None)
    check("từ khóa (tài liệu thật): " + q, h and h[0]["source_file"] == want, [(x["source_file"], round(x["score"], 2)) for x in h])
# Chế độ chỉ từ khóa chỉ là dự phòng khi Gemini embedding lỗi; câu lạc đề cuối cùng vẫn do Gemini từ chối.
for q in ["Hôm nay thời tiết thế nào?", "Giá bitcoin hôm nay"]:
    check("từ khóa: ngoài phạm vi bị loại: " + q, orch.search_kb(q, None) == [], orch.search_kb(q, None))

# ---- v6: prompt và fallback ----
sp = orch.SYSTEM_PROMPT
check("v6: prompt cho trả lời giá/tồn kho ngay khi chưa biết xe", "trả lời ngay" in sp)
check("v6: prompt nêu sản phẩm Universal không cần hỏi xe", "Universal" in sp)
check("v6: prompt cấm chèn tài liệu vào câu trả lời sản phẩm", "không chèn nội dung tài liệu" in sp)
_kb = [{"source_file": "chinh_sach.txt", "text": "Bảo hành 12 tháng. " * 40, "score": 0.70}]
_pr = [{"name": "Bugi A", "price": 1, "stock": 2, "compatible_models": "Winner X", "score": 0.50}]
_r = orch.fallback_answer("Phụ tùng được bảo hành bao lâu?", _pr, _kb)
check("v6: câu hỏi chính sách -> trả KB trước", "chinh_sach.txt" in _r and "Bugi A" not in _r)
check("v6: KB cắt tối đa 600 ký tự", len(_r) < 800)
_r = orch.fallback_answer("Bugi cho Winner X", _pr, [])
check("v6: câu hỏi sản phẩm vẫn liệt kê sản phẩm", "Bugi A" in _r)
_r = orch.fallback_answer("Thêm bugi vào giỏ", _pr, _kb)
check("v6: yêu cầu hành động không bị trả KB", "chưa thực hiện" in _r)

# ---- 3. Giới hạn tần suất, user_id ----
orch.RL_SESSION_PER_MIN, orch.RL_CONNECTION_PER_MIN, orch.RL_GLOBAL_PER_DAY = 3, 100, 100
res = [orch.check_rate_limit("sess1", "conn1") for _ in range(5)]
check("rate limit: 3 lần đầu qua, lần 4 bị chặn", res[:3] == [None] * 3 and res[3] and res[4])
check("rate limit: session khác không bị ảnh hưởng", orch.check_rate_limit("sess2", "conn2") is None)
orch.RL_GLOBAL_PER_DAY = 1
check("rate limit toàn cục theo ngày", "giới hạn số câu hỏi" in (orch.check_rate_limit("sess3", "conn3") or ""))
orch.AUTH_MODE = "client"
check("AUTH_MODE=client: lấy user_id từ body", orch.resolve_user_id({}, {"user_id": "U1"}) == "U1")
orch.AUTH_MODE = "authorizer"
ev = {"requestContext": {"authorizer": {"user_id": "U9"}}}
check("AUTH_MODE=authorizer: bỏ qua user_id giả trong body", orch.resolve_user_id(ev, {"user_id": "HACKER"}) == "U9")
check("authorizer: khách (không token) -> None", orch.resolve_user_id({"requestContext": {"authorizer": {"user_id": ""}}}, {"user_id": "HACKER"}) is None)

# ---- 4. Authorizer với khóa RSA thật ----
from cryptography.hazmat.primitives.asymmetric import rsa
import jwt
os.environ.update(COGNITO_USER_POOL_ID="ap-southeast-1_TEST", COGNITO_CLIENT_ID="client123")
import ws_authorizer as wa
priv = rsa.generate_private_key(public_exponent=65537, key_size=2048)
jwk = json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(priv.public_key())); jwk["kid"] = "k1"
wa._jwks.update(keys={"k1": jwk}, t=time.time())
def tok(**over):
    c = {"iss": wa.ISSUER, "sub": "sub-1", "token_use": "id", "aud": "client123", "exp": int(time.time()) + 600, "custom:user_id": "USR_1"}
    c.update(over)
    return jwt.encode({k: v for k, v in c.items() if v is not None}, priv, algorithm="RS256", headers={"kid": "k1"})
def call(token=None):
    ev = {"methodArn": "arn:aws:execute-api:x:y:z/dev/$connect", "queryStringParameters": ({"token": token} if token else None)}
    return wa.lambda_handler(ev, None)
effect = lambda r: r["policyDocument"]["Statement"][0]["Effect"]
r = call(tok()); check("authorizer: token hợp lệ -> Allow + user_id", effect(r) == "Allow" and r["context"]["user_id"] == "USR_1")
check("authorizer: access token hợp lệ", effect(call(tok(token_use="access", aud=None, client_id="client123"))) == "Allow")
check("authorizer: token hết hạn -> Deny", effect(call(tok(exp=int(time.time()) - 5))) == "Deny")
check("authorizer: sai issuer -> Deny", effect(call(tok(iss="https://evil"))) == "Deny")
check("authorizer: sai client -> Deny", effect(call(tok(aud="other"))) == "Deny")
other = rsa.generate_private_key(public_exponent=65537, key_size=2048)
forged = jwt.encode({"iss": wa.ISSUER, "sub": "x", "token_use": "id", "aud": "client123", "exp": int(time.time()) + 600}, other, algorithm="RS256", headers={"kid": "k1"})
check("authorizer: chữ ký giả -> Deny", effect(call(forged)) == "Deny")
none_alg = jwt.encode({"iss": wa.ISSUER, "sub": "x"}, None, algorithm="none", headers={"kid": "k1"})
check("authorizer: alg=none -> Deny", effect(call(none_alg)) == "Deny")
g = call(); check("authorizer: khách được Allow, user_id rỗng", effect(g) == "Allow" and g["context"]["user_id"] == "")
wa.ALLOW_GUEST = False; check("authorizer: ALLOW_GUEST=0 chặn khách", effect(call()) == "Deny")

print(f"\nĐạt {passed}, lỗi {failed}")
sys.exit(1 if failed else 0)
