"""Test offline cho backend/services/sync_to_kb/handler.py (S3 + Gemini giả). Chạy: python backend/chatbot/tests/test_sync_to_kb_offline.py"""
import json
import os
import sys
import types
import hashlib
import random
from unittest import mock

os.environ.update(
    VECTOR_BUCKET="b",
    PRODUCTS_TABLE="Products_Replica",
    POLICIES_TABLE="StorePolicies_Replica",
    AWS_DEFAULT_REGION="ap-southeast-1",
    AWS_ACCESS_KEY_ID="x",
    AWS_SECRET_ACCESS_KEY="x"
)
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "services", "sync_to_kb")))
import handler as h
from botocore.exceptions import ClientError


class FakeS3:
    def __init__(self):
        self.f = {}
        self.n = 0
        self.fail_next = 0

    def get_object(self, Bucket, Key):
        if Key not in self.f:
            raise ClientError({"Error": {"Code": "NoSuchKey"}}, "get")
        b, e = self.f[Key]
        return {"Body": types.SimpleNamespace(read=lambda: b), "ETag": e}

    def put_object(self, Bucket, Key, Body, ContentType, IfMatch=None, IfNoneMatch=None):
        if self.fail_next:  # giả lập batch khác vừa ghi đè
            self.fail_next -= 1
            self.n += 1
            self.f[Key] = (self.f[Key][0], f'"e{self.n}"')
            raise ClientError({"Error": {"Code": "PreconditionFailed"}}, "put")
        cur = self.f.get(Key)
        if IfMatch and (not cur or cur[1] != IfMatch):
            raise ClientError({"Error": {"Code": "PreconditionFailed"}}, "put")
        if IfNoneMatch and cur:
            raise ClientError({"Error": {"Code": "PreconditionFailed"}}, "put")
        self.n += 1
        self.f[Key] = (Body, f'"e{self.n}"')


calls = []


def fake_gemini(texts):
    calls.append(list(texts))
    out = []
    for t in texts:
        r = random.Random(hashlib.md5(t.encode()).hexdigest())
        out.append(h.normalize([r.uniform(-1, 1) for _ in range(h.EMBED_DIM)]))
    return out


def S(v):
    return {"S": v}


def N(v):
    return {"N": str(v)}


def prod_rec(pid, name, price=100, stock=5, ev="MODIFY", desc="mo ta", models=("Wave", "Vision")):
    img = {
        "ProductID": S(pid), "name": S(name), "price": N(price), "stock": N(stock),
        "description": S(desc), "category": S("Phanh"), "brand": S("Honda"),
        "status": S("active"), "compatible_models": {"L": [S(m) for m in models]}
    }
    r = {
        "eventName": ev,
        "eventSourceARN": "arn:aws:dynamodb:ap-southeast-1:1:table/Products_Replica/stream/2026",
        "dynamodb": {"Keys": {"ProductID": S(pid)}}
    }
    if ev != "REMOVE":
        r["dynamodb"]["NewImage"] = img
    return r


def pol_rec(pid, title, content, ev="MODIFY"):
    r = {
        "eventName": ev,
        "eventSourceARN": "arn:aws:dynamodb:ap-southeast-1:1:table/StorePolicies_Replica/stream/2026",
        "dynamodb": {"Keys": {"PolicyID": S(pid)}}
    }
    if ev != "REMOVE":
        r["dynamodb"]["NewImage"] = {"PolicyID": S(pid), "title": S(title), "content": S(content)}
    return r


def run(records):
    return h.lambda_handler({"Records": records}, None)


def load(key):
    return json.loads(fake.f[h.PRODUCT_KEY if key == "p" else h.KB_KEY][0])["items"]


fake = FakeS3()
ok = 0


def check(name, cond):
    global ok
    print(("DAT  " if cond else "LOI  ") + name)
    ok += bool(cond)
    if not cond:
        raise SystemExit(1)


if __name__ == "__main__":
    with mock.patch.object(h, "s3", fake), mock.patch.object(h, "_call_gemini", fake_gemini):
        # 1. file chưa có -> tạo mới (IfNoneMatch)
        run([prod_rec("P1", "Phanh dia", ev="INSERT"), prod_rec("P2", "Lop xe", ev="INSERT")])
        check("tao moi products.json, embed 2 muc", len(load("p")) == 2 and sum(map(len, calls)) == 2)
        check("embedding 768 chieu, da chuan hoa", len(load("p")[0]["embedding"]) == 768)

        # 2. chỉ đổi giá/tồn kho -> KHÔNG embed lại
        calls.clear()
        h._embed_cache.clear()
        run([prod_rec("P1", "Phanh dia", price=999, stock=0)])
        p1 = next(i for i in load("p") if i["ProductID"] == "P1")
        check("doi gia/ton kho: khong goi Gemini", calls == [])
        check("gia/ton kho da cap nhat", p1["price"] == 999 and p1["stock"] == 0 and p1["embedding"])
        check("search_text khong chua gia", "999" not in p1["search_text"])

        # 3. đổi mô tả -> embed lại đúng 1 mục
        calls.clear()
        h._embed_cache.clear()
        run([prod_rec("P1", "Phanh dia", desc="mo ta moi")])
        check("doi mo ta: embed lai dung 1 muc", sum(map(len, calls)) == 1 and len(load("p")) == 2)

        # 4. REMOVE, và INSERT rồi REMOVE trong cùng batch
        run([prod_rec("P2", "", ev="REMOVE")])
        check("REMOVE xoa muc", [i["ProductID"] for i in load("p")] == ["P1"])
        calls.clear()
        run([prod_rec("P9", "Tam", ev="INSERT"), prod_rec("P9", "", ev="REMOVE")])
        check("INSERT roi REMOVE cung batch: khong embed, khong them", calls == [] and len(load("p")) == 1)

        # 5. chính sách: chunk, chỉ embed đoạn đổi
        calls.clear()
        h._embed_cache.clear()
        txt = "Chinh sach doi tra\n\nDoi tra trong 7 ngay.\n\nPhi van chuyen do khach tra."
        run([pol_rec("POL1", "Doi tra", txt, ev="INSERT")])
        kb = load("k")
        check("policy chia 2 chunk, embed 2", len(kb) == 2 and sum(map(len, calls)) == 2 and kb[0]["chunk_id"] == "POL1#0")
        calls.clear()
        h._embed_cache.clear()
        run([pol_rec("POL1", "Doi tra", txt.replace("7 ngay", "14 ngay"))])
        check("sua 1 doan: chi embed lai 1 chunk", sum(map(len, calls)) == 1 and len(load("k")) == 2)
        run([pol_rec("POL1", "", "", ev="REMOVE")])
        check("REMOVE policy xoa moi chunk", load("k") == [])

        # 6. ghi đè giữa chừng (412) -> đọc lại, không mất dữ liệu, không embed thêm lần nữa
        calls.clear()
        h._embed_cache.clear()
        fake.fail_next = 1
        run([prod_rec("P3", "Bugi", ev="INSERT")])
        check("412: thu lai thanh cong, khong mat muc cu", {i["ProductID"] for i in load("p")} == {"P1", "P3"})
        check("412: khong goi Gemini lan 2", sum(map(len, calls)) == 1)

        # 7. bảng lạ / không có Records
        check("bang la bi bo qua", run([{"eventName": "INSERT", "eventSourceARN": "arn:x:table/Orders/stream/1",
                                          "dynamodb": {"Keys": {"OrderID": S("o")}}}])["statusCode"] == 200)
        check("goi tay khong co action -> 400", h.lambda_handler({}, None)["statusCode"] == 400)

        # 8. full_resync: có phân trang, tái dùng embedding, xoá mục mồ côi
        class T:
            def __init__(s, pages):
                s.pages = pages

            def scan(s, **kw):
                i = kw.get("ExclusiveStartKey", {}).get("i", 0)
                r = {"Items": s.pages[i]}
                if i + 1 < len(s.pages):
                    r["LastEvaluatedKey"] = {"i": i + 1}
                return r

        def D(pid, name):
            return {
                "ProductID": pid, "name": name, "price": 100, "stock": 5,
                "description": "mo ta moi", "category": "Phanh", "brand": "Honda",
                "status": "active", "compatible_models": ["Wave", "Vision"]
            }

        tables = {
            "Products_Replica": T([[D("P1", "Phanh dia")], [D("P4", "Den")]]),
            "StorePolicies_Replica": T([[]])
        }
        calls.clear()
        h._embed_cache.clear()
        with mock.patch.object(h.dynamodb, "Table", lambda n: tables[n]):
            res = h.lambda_handler({"action": "full_resync"}, None)
        ids = {i["ProductID"] for i in load("p")}
        check("full_resync: bo P3 mo coi, them P4 (trang 2)", ids == {"P1", "P4"})
        check("full_resync: chi embed muc moi P4", sum(map(len, calls)) == 1)

    print(f"\n{ok} kiem tra dat")
