# Chatbot tư vấn phụ tùng xe máy trên AWS (RAG, không dùng OpenSearch)

Chatbot hội thoại cho website bán phụ tùng xe máy: hỏi chính sách cửa hàng, tư vấn sản phẩm theo dòng xe, kiểm tra tồn kho,
thêm và xem giỏ hàng, chuyển cho nhân viên. Chạy hoàn toàn bằng dịch vụ AWS theo nhu cầu (serverless) và Gemini API, không cần OpenSearch.

## Kiến trúc

```
Khách (web) ── WebSocket ──> API Gateway ──> Lambda chat-receiver ──(bất đồng bộ)──> Lambda chat-orchestrator-v2 (container)
                                                                                     │
        ┌───────────────────────────────┬──────────────────────┬───────────────────────┼───────────────────────────┐
        S3: vectors/kb.json              DynamoDB: Products,    SSM: khóa Gemini         EventBridge ──> Lambda ──> Gmail SMTP
        S3: vectors/products.json        Carts, Users,          (SecureString)           (chuyển nhân viên)
        (nạp vào RAM Lambda, làm mới     chatbot-sessions
        theo ETag mỗi 300 giây)          (lịch sử, giới hạn tần suất)
```

- Tìm kiếm: embedding Gemini (`gemini-embedding-001`, 768 chiều) + BM25, độ tương đồng cosine, ngưỡng điểm hiệu chỉnh bằng dữ liệu thật.
- Trả lời: Gemini (chuỗi mô hình dự phòng), có chế độ dự phòng liệt kê sản phẩm khi Gemini quá tải.
- Giỏ hàng: công cụ `add_to_cart` kiểm tra tồn kho, giới hạn 10 mỗi lần, không tự đổi số lượng của khách.
- Chống lạm dụng: giới hạn theo phiên, theo kết nối và theo ngày (DynamoDB).
- Đo được: cold start khoảng 6,8 giây, bộ nhớ dùng 142 MB, các lượt sau 0,3-3 giây (khi Gemini ổn định).

- Chuyển nhân viên: công cụ `request_human_agent` phát sự kiện `HumanHandoverRequested` lên EventBridge; Lambda `chat-handover-mailer` (stack `infra/chatbot_mailer.yaml`) gửi email qua Gmail SMTP bằng mật khẩu ứng dụng lưu trong SSM. Thay cho SNS vì SNS gửi thư mang nhãn "AWS Notification".
- Tư vấn theo xe: hỏi giá, tồn kho thì trả lời ngay không bắt khai xe; sản phẩm Universal không cần hỏi xe; chỉ hỏi xe khi mua hoặc thêm giỏ (từ bản v6).
- Khi Gemini quá tải, chế độ dự phòng trả đoạn tài liệu chính sách trước cho câu hỏi bảo hành, đổi trả, vận chuyển; câu hỏi sản phẩm vẫn liệt kê sản phẩm.

## Phiên bản image

| Tag | Nội dung chính |
|---|---|
| v1-v4 | Dựng kiến trúc không OpenSearch, vector trên S3, Gemini embedding, rate limit, giỏ hàng, chuyển nhân viên |
| v5 | Chặn tự giảm số lượng giỏ hàng, bỏ chèn tài liệu thừa, ngắt mạch Gemini |
| v6 | Prompt trả lời ngay khi chưa biết xe, Universal không hỏi xe, fallback ưu tiên KB cho câu hỏi chính sách, `KB_MIN_KW` mặc định 0.4 |

Kết quả test đầu cuối v6 (buổi sáng, Gemini nhanh): KB 6/6, sản phẩm 12/12, ngoài phạm vi 4/4, Garage, giỏ hàng và chuyển nhân viên (email Gmail) đều đạt; trung bình khoảng 2,5 giây mỗi câu.

## Cấu trúc repo

| Thư mục | Nội dung |
|---|---|
| `src/orchestrator/` | Lambda chính (`chat_orchestrator_v2.py`), `Dockerfile.v2`, `requirements.v2.txt` |
| `src/authorizer/` | Lambda authorizer cho `$connect` (JWT Cognito), tùy chọn |
| `infra/` | `chatbot_stack.yaml` (CloudFormation chính), `chatbot_mailer.yaml` (email chuyển nhân viên qua Gmail SMTP), `chatbot_ops.yaml` (cảnh báo, ngân sách), `preflight.sh` |
| `scripts/` | `build_vector_snapshot.py` (dựng vector, hiệu chỉnh ngưỡng), `migrate_data.py`, `test_gemini_latency.py` |
| `data/kb_docs/` | 5 tài liệu KB: bảo hành, đổi trả, vận chuyển, hướng dẫn chọn phụ tùng, FAQ |
| `tests/` | 39 test chạy offline (`test_v2_offline.py`) và notebook test đầu cuối qua WebSocket |
| `docs/` | `DEPLOY.md`, `MIGRATION_V2.md`, `LESSONS_LEARNED.md`, `WORKLOG.md`, `iam/` (chính sách IAM) |

## Chạy test offline

```bash
pip install boto3 google-genai pyjwt cryptography
python3 tests/test_v2_offline.py
```

## Triển khai

Xem [`docs/DEPLOY.md`](docs/DEPLOY.md). Tóm tắt: kiểm tra quyền (`infra/preflight.sh`) → tạo ECR, build và push image →
lưu khóa Gemini vào SSM → `aws cloudformation deploy` với `infra/chatbot_stack.yaml` → dựng vector → test → stack giám sát.
Các chính sách IAM cần xin quản trị tài khoản nằm ở `docs/iam/`.

## Lưu ý bảo mật

- Không lưu khóa API hay access key trong repo. Khóa Gemini chỉ nằm trong SSM Parameter Store.
- Không đưa dữ liệu thật (xuất từ bảng Users, Carts) vào repo.
- Số tài khoản AWS trong file IAM để dạng `<ACCOUNT_ID>`.
