# Chuyển chatbot sang bản không dùng OpenSearch Serverless (v2)

## Không cần làm lại toàn bộ
Giữ nguyên: API Gateway `chatbot-ws`, Lambda `chat-receiver`, DynamoDB, SNS, giỏ hàng, chuyển nhân viên, Gemini orchestration, test notebook.
Thay đổi: embedding (bge-m3 → Gemini 768 chiều), kho vector (OpenSearch → file JSON trên S3 nạp vào bộ nhớ Lambda), nơi lấy khóa Gemini (SSM), warmup, thêm giới hạn tần suất và authorizer.

## Bảng đối chiếu với Well-Architected
| Trụ cột | Bản cũ | Bản v2 | File |
|---|---|---|---|
| Cost | OpenSearch ≈ $0,37/giờ khi thức, image vài GB, Lambda 3008 MB | Không OpenSearch, image nhỏ, Lambda 512–1024 MB, Secrets/SSM cache | `chat_orchestrator_v2.py`, `Dockerfile.v2` |
| Security | Không auth ở `$connect`, tin `user_id` từ client | JWT Cognito ở `$connect`, `user_id` lấy từ authorizer, giới hạn độ dài câu hỏi | `ws_authorizer.py`, `AUTH_MODE=authorizer` |
| Reliability | OpenSearch hỏng là chết cả bot | Không còn phụ thuộc dịch vụ vector; Gemini embedding lỗi thì tìm từ khóa; S3 lỗi thì dùng bản vector cũ trong bộ nhớ | `search_kb`, `VectorStore` |
| Performance | Cold start 150–295 giây | Không tải model; cold start chỉ còn nạp 2 file JSON (dự kiến vài giây, cần đo) | |
| Ops Excellence | Không cảnh báo | Budgets (không tính credit), 8 CloudWatch Alarms, SNS, bộ test offline | `ops/chatbot_ops.yaml`, `tests/` |

## Các bước (làm theo thứ tự, mỗi bước kiểm tra xong mới sang bước sau)
1. **Khóa Gemini vào SSM**: tạo SecureString `/chatbot/gemini_api_key` bằng console (không dán khóa vào file hay chat). Gán biến `GEMINI_SSM_PARAM=/chatbot/gemini_api_key`. Secrets Manager vẫn là phương án dự phòng.
2. **Tạo vector**: trên máy có khóa Gemini và quyền AWS:
   `GEMINI_API_KEY=... python build_vector_snapshot.py --upload`
   Lệnh này đọc 5 file tài liệu từ `s3://team-chatbot-kb-dev-999/knowledge-base/`, sản phẩm từ bảng `Products`, ghi `vectors/kb.json` và `vectors/products.json`.
3. **Hiệu chỉnh ngưỡng**: `python build_vector_snapshot.py --calibrate out/kb.json out/products.json`. Chọn `KB_MIN_SCORE` nằm giữa điểm thấp nhất của nhóm `in_kb` và điểm cao nhất của nhóm `out`; làm tương tự cho `PRODUCT_MIN_SCORE`. Giá trị mặc định (0,55 và 0,45) chỉ là điểm xuất phát, chưa đo trên dữ liệu thật.
4. **IAM của Lambda orchestrator**: thêm `s3:GetObject` và `s3:ListBucket`/`HeadObject` cho `vectors/*`, `ssm:GetParameter` cho tham số trên, `dynamodb:UpdateItem` cho `chatbot-sessions`. Bỏ quyền `aoss:*` sau khi chạy ổn. Bật TTL của bảng `chatbot-sessions` trên thuộc tính `expires_at` để bộ đếm tự xóa.
5. **Build image mới**: đặt `chat_orchestrator_v2.py`, `requirements.v2.txt`, `Dockerfile.v2` cùng thư mục, `docker build -f Dockerfile.v2 -t chat-orchestrator:v2 .`, đẩy lên ECR với tag mới. Tạo **phiên bản mới của Lambda**, không ghi đè bản cũ, để quay lại được.
6. **Cấu hình Lambda**: memory 1024 MB (thử 512 sau khi đo), timeout giữ 600 giây hoặc giảm còn 120, biến môi trường `VECTOR_BUCKET`, `GEMINI_SSM_PARAM`, `AUTH_MODE=client` (đổi sang `authorizer` ở bước 8). Xóa `PREFETCH_MODEL`, `MODEL_PATH`, `AOSS_ENDPOINT`.
7. **Test**: chạy lại `test_chatbot_answers.ipynb` (9 tình huống + 5 câu bảo hành) và đo thời gian câu đầu tiên sau khi để Lambda nghỉ vài giờ. Nếu đạt, tắt hoặc xóa OpenSearch collection (sau khi sao lưu bằng `opensearch_backup_restore`).
8. **Authorizer**: **thử trên một API WebSocket riêng**, không đụng stage `dev` đang chạy (bài học 21/10). Tạo Lambda từ `ws_authorizer.py` (cài `requirements.authorizer.txt`), biến `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`, `USER_ID_CLAIM`, `ALLOW_GUEST=1`; gắn vào `$connect` với identity source `route.request.querystring.token`. Sau đó sửa `chat-receiver` để chuyển `event["requestContext"]["authorizer"]` sang orchestrator khi gọi bất đồng bộ (mình chưa thấy code chat-receiver nên chưa sửa phần này), rồi đặt `AUTH_MODE=authorizer`. Frontend nối `wss://.../dev/?token=<JWT>`.
9. **Giám sát**: triển khai `ops/chatbot_ops.yaml` bằng CloudFormation (tham số `AlertEmail`, `MonthlyBudgetUSD`), xác nhận email đăng ký SNS.
10. **Warmup**: có thể để EventBridge Scheduler tắt; nếu bật, đặt chu kỳ 30–60 phút, vì bản v2 chỉ nạp JSON và gọi một lần embed.

## Điều cần biết
- Kho vector nằm trong bộ nhớ: cập nhật sản phẩm hay tài liệu chỉ cần chạy lại bước 2, Lambda nhận bản mới trong tối đa 5 phút (`VECTOR_TTL_S`). Cách này phù hợp đến vài nghìn mục; vượt quá thì cần kho vector khác.
- Tồn kho và giá vẫn đọc từ DynamoDB ở mỗi câu trả lời (`refresh_stock`), nên bản chụp cũ không làm sai tồn kho.
- Vector tài liệu và vector câu hỏi phải cùng model và cùng số chiều (768). Đổi model thì phải tạo lại cả hai file.
- Giới hạn tần suất mặc định: 8 câu/phút/session, 12 câu/phút/kết nối, 2000 câu/ngày toàn hệ thống (đổi bằng biến môi trường `RL_*`). Mỗi câu hỏi ghi vài lần vào DynamoDB; vẫn trong free tier ở quy mô demo.
- Chế độ chỉ từ khóa (khi Gemini embedding lỗi) chỉ là dự phòng; câu lạc đề có thể vẫn ra vài đoạn yếu, Gemini sẽ từ chối ở bước trả lời.
- Chưa đo thực tế: cold start mới, độ chính xác tìm kiếm với Gemini 768 chiều trên dữ liệu thật (embed_compare cho 82% hit@1), chi phí thật. Cần chạy bước 3 và 7 trước khi báo số cho trưởng nhóm.
- Test offline: `python tests/test_v2_offline.py` (32 kiểm tra: snapshot, tìm kiếm, ETag, giới hạn tần suất, authorizer với khóa RSA thật).
