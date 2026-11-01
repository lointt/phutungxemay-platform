# Quyền IAM cho người dựng chatbot (gửi cho leader)

Mục tiêu: tạo một IAM user (hoặc nhóm) chỉ đủ quyền dựng và vận hành chatbot, không cấp quyền quản trị toàn bộ.
Không dùng tài khoản root. Bật MFA cho user.

## Thay các giá trị giữ chỗ trong file JSON
| Giữ chỗ | Thay bằng |
|---|---|
| `<ACCOUNT_ID>` | Số tài khoản AWS của leader (12 chữ số) |
| `<TEN_BUCKET>` | Tên bucket S3 của chatbot (tên bucket phải duy nhất toàn cầu) |
| `<API_ID>` | ID của WebSocket API sau khi tạo (chỉ cần cho policy runtime của orchestrator, có thể để `*` lúc đầu) |

Vùng: `ap-southeast-1` (Singapore).

## A. Quyền cho IAM user dựng chatbot
Gắn 8 policy dưới đây (tạo thành *customer managed policy*, nên gom vào một IAM group `chatbot-deployers` rồi thêm user vào group). Mỗi file nhỏ hơn giới hạn 6144 ký tự của policy.

| File | Dịch vụ | Cho phép làm gì | Phạm vi |
|---|---|---|---|
| `01-chatbot-deploy-iam.json` | IAM | Tạo/sửa/xóa role và policy cho Lambda; chỉ truyền role cho Lambda, EventBridge, Scheduler, API Gateway, CloudFormation | Chỉ role `chat-*`, `chatbot-*` và policy `chatbot-*` |
| `02-chatbot-deploy-lambda.json` | Lambda | Tạo, cập nhật code/cấu hình, gọi, cấp quyền gọi cho hàm | Chỉ hàm `chat-*`, `chatbot-*` |
| `03-chatbot-deploy-ecr.json` | ECR | Đăng nhập, tạo repo, đẩy image, đặt lifecycle và repo policy | Chỉ repo `chat-orchestrator*` |
| `04-chatbot-deploy-apigateway.json` | API Gateway (WebSocket) | Tạo/sửa API, route, integration, stage | Toàn bộ API v2 trong vùng (WebSocket dùng chung tiền tố `/apis`) |
| `05-chatbot-deploy-dynamodb.json` | DynamoDB | Tạo bảng, bật TTL, đọc/ghi dữ liệu để nạp và kiểm thử | Chỉ 5 bảng: Products, Carts, Orders, Users, chatbot-sessions |
| `06-chatbot-deploy-s3-ssm.json` | S3, SSM | Tạo bucket và đọc/ghi file vector; lưu khóa Gemini dạng SecureString | Chỉ bucket chatbot, tham số `/chatbot/*` |
| `07-chatbot-deploy-messaging.json` | SNS, EventBridge, Scheduler | Chủ đề chuyển nhân viên, rule, lịch warmup | Chỉ tên bắt đầu bằng `chat` |
| `08-chatbot-deploy-observability.json` | CloudWatch Logs, Alarms, Budgets, Cost Explorer, CloudFormation | Đọc log, tạo cảnh báo, ngân sách, đọc chi phí, triển khai stack | Log `/aws/lambda/chat*`, budget `chatbot-*`, stack `chatbot-*` |

Thêm một policy do AWS quản lý: **`AWSCloudShellFullAccess`** (để chạy lệnh build, tạo vector bằng CloudShell).

### Lưu ý
- Nếu dùng tên khác tiền tố `chat`/`chatbot` cho Lambda, role, SNS, rule thì sửa lại tên trong policy.
- Muốn chặt hơn: đặt **permission boundary** cho các role do user này tạo, để role đó không thể có quyền vượt mức cho phép.
- `iam:PassRole` đã giới hạn theo dịch vụ nhận role. Đây là điểm chặn leo thang đặc quyền quan trọng nhất.
- Policy có thể kiểm tra bằng **IAM Access Analyzer → Policy validation** trước khi gắn.
- Cần quyền Cognito (`cognito-idp:DescribeUserPool`, `ListUserPools`) khi gắn authorizer JWT. Hiện chưa bật.

## B. Role mà Lambda dùng khi chạy (do user ở phần A tạo)
| File | Gắn cho | Dùng làm gì |
|---|---|---|
| `12-trust-policy-lambda.json` | Cả hai role | Cho dịch vụ Lambda dùng role |
| `10-runtime-role-orchestrator.json` | Role của `chat-orchestrator-v2` | Ghi log; đọc/ghi 4 bảng; đọc vector trong S3; đọc khóa Gemini từ SSM; gửi sự kiện chuyển nhân viên; trả lời qua WebSocket |
| `11-runtime-role-receiver.json` | Role của `chat-receiver` | Ghi log; gọi `chat-orchestrator-v2` |

Hàm không nằm trong VPC nên không cần quyền mạng (không cần `AWSLambdaVPCAccessExecutionRole`).

## C. Việc phải làm thủ công (không có trong policy)
1. **EventBridge → SNS:** đặt policy của chủ đề SNS cho phép `events.amazonaws.com` gửi (`sns:Publish`); đăng ký email nhận thông báo.
2. **API Gateway WebSocket → Lambda:** cấp quyền `lambda:InvokeFunction` cho `apigateway.amazonaws.com` trên `chat-receiver` (qua `lambda:AddPermission`, đã có trong policy 02).
3. **Khóa Gemini:** nhập trực tiếp vào SSM `/chatbot/gemini_api_key` bằng console. Không gửi qua chat hay file.
4. **Ngân sách:** triển khai `ops/chatbot_ops.yaml` để có cảnh báo chi phí và cảnh báo lỗi.

## D. Cách tạo user (leader làm)
1. IAM → **Policies → Create policy → JSON**, dán từng file 01–08, thay giữ chỗ, đặt tên đúng như tên file (bỏ đuôi `.json`).
2. IAM → **User groups → Create group** `chatbot-deployers`, gắn 8 policy trên và `AWSCloudShellFullAccess`.
3. IAM → **Users → Create user**, thêm vào nhóm, bật đăng nhập console, bắt buộc đổi mật khẩu lần đầu, bật MFA.
4. Gửi thông tin đăng nhập qua kênh riêng, không gửi qua tin nhắn công khai.
