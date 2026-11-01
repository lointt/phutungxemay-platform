# Dựng lại chatbot ở tài khoản AWS mới (của leader)

Làm theo thứ tự. Mọi lệnh chạy trong **AWS CloudShell** (biểu tượng `>_` ở thanh trên), vùng **Asia Pacific (Singapore)**.
Có hai tài khoản: **CŨ** (tài khoản của bạn, đang chạy chatbot) và **MỚI** (tài khoản leader cấp, user `AI-Engineer`).

## Bước 0. Kiểm tra quyền (tài khoản MỚI)
1. Đăng nhập user được cấp, mở CloudShell, **Actions → Upload file**: tải lên `chatbot_new_account.zip`.
2. Chạy:
```
unzip -o chatbot_new_account.zip && cd new_account
bash preflight.sh
```
Mục nào báo `THIEU` thì nhờ leader cấp thêm quyền theo `iam/IAM_POLICIES.md`. Nếu **IAM** báo thiếu: nhờ leader tạo hai role (xem Phụ lục) và dùng tham số `ExistingReceiverRoleArn`, `ExistingOrchestratorRoleArn` ở bước 4.
Với tài khoản mới: kiểm tra mục **Service Quotas → Lambda → Concurrent executions**. Tài khoản mới đôi khi chỉ có hạn mức rất thấp. Dưới 10 thì chatbot vẫn chạy được với vài người dùng.

## Bước 1. Lấy dữ liệu từ tài khoản CŨ
Trong CloudShell của tài khoản **CŨ**: upload `migrate_data.py`, rồi chạy
```
python3 migrate_data.py export --bucket team-chatbot-kb-dev-999
zip -r export.zip export
```
Tải `export.zip` về máy (Actions → Download file). File này chứa bảng Products, Users và 5 file tài liệu. Không chứa khóa bí mật.
(Giỏ hàng test không được mang theo, đúng ý muốn: tài khoản mới bắt đầu giỏ trống.)

## Bước 2. Tạo kho image và đẩy image orchestrator (tài khoản MỚI)
```
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
REGION=ap-southeast-1
REPO=$ACCOUNT.dkr.ecr.$REGION.amazonaws.com/chat-orchestrator-v2

aws ecr create-repository --repository-name chat-orchestrator-v2 --region $REGION
# Cho phép dịch vụ Lambda kéo image từ kho này (cần khi tạo hàm bằng CloudFormation/CLI)
cat > /tmp/ecr-policy.json <<POL
{"Version":"2012-10-17","Statement":[{"Sid":"LambdaPull","Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},
 "Action":["ecr:BatchGetImage","ecr:GetDownloadUrlForLayer"],
 "Condition":{"StringLike":{"aws:sourceArn":"arn:aws:lambda:$REGION:$ACCOUNT:function:*"}}}]}
POL
aws ecr set-repository-policy --repository-name chat-orchestrator-v2 --policy-text file:///tmp/ecr-policy.json --region $REGION

aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ACCOUNT.dkr.ecr.$REGION.amazonaws.com

cd src/orchestrator
docker build -f Dockerfile.v2 -t $REPO:v1 .
docker push $REPO:v1
cd ../..
echo $REPO:v1
```
Nếu sau này Lambda báo lỗi "image manifest ... not supported", build lại với `--provenance=false`.
Giữ lại dòng cuối (`...:v1`), đó là `ImageUri`.

## Bước 3. Lưu khóa Gemini vào SSM (tài khoản MỚI)
Tạo khóa mới ở Google AI Studio nếu muốn tách riêng, rồi nhập **không lộ ra màn hình và không lưu vào lịch sử lệnh**:
```
read -s -p "Dan khoa Gemini: " KEY; echo
aws ssm put-parameter --name /chatbot/gemini_api_key --type SecureString --value "$KEY" --region ap-southeast-1
unset KEY
```
(Hoặc làm bằng console: Systems Manager → Parameter Store → Create parameter, kiểu SecureString.)

## Bước 4. Triển khai stack
Thay `TEN_BUCKET` (chữ thường, duy nhất toàn cầu, ví dụ `chatbot-kb-<ma-nhom>-dev`) và email:
```
aws cloudformation deploy \
  --template-file infra/chatbot_stack.yaml \
  --stack-name chatbot-v2 \
  --capabilities CAPABILITY_NAMED_IAM \
  --region ap-southeast-1 \
  --parameter-overrides \
    BucketName=TEN_BUCKET \
    ImageUri=$REPO:v1
```
(Không cần `HandoverEmail`: email chuyển nhân viên do stack `chatbot-mailer` ở bước 4b gửi qua Gmail. Chỉ điền `HandoverEmail=...` nếu vẫn muốn dùng SNS.)
Tùy chọn:
- Bảng `Products`, `Carts`, `Users`, `chatbot-sessions` đã tồn tại ở tài khoản này (dùng chung với app thật): thêm `CreateTables=false`.
- User không có quyền IAM: thêm `ExistingReceiverRoleArn=arn:... ExistingOrchestratorRoleArn=arn:...`.

Khi xong, xem kết quả:
```
aws cloudformation describe-stacks --stack-name chatbot-v2 --query "Stacks[0].Outputs" --output table --region ap-southeast-1
```
Lấy `WebSocketUrl` (địa chỉ mới để dùng cho frontend và notebook test).

Nếu stack lỗi: `aws cloudformation describe-stack-events --stack-name chatbot-v2 --max-items 15` để xem tài nguyên nào thất bại. Xóa stack lỗi (`delete-stack`) rồi tạo lại; bucket và bảng có `Retain` nên cần xóa tay nếu muốn tạo lại cùng tên.

## Bước 4b. Email chuyển nhân viên qua Gmail SMTP
SNS gửi thư mang nhãn "AWS Notification", nên dùng Lambda gửi thẳng qua Gmail.
1. Gmail gửi: bật Xác minh 2 bước tại myaccount.google.com/security, rồi tạo **Mật khẩu ứng dụng** tại myaccount.google.com/apppasswords (mã 16 ký tự).
2. Lưu mã vào SSM (không dán vào chat hay file):
```
read -s -p "" GPW; echo
aws ssm put-parameter --name /chatbot/gmail_app_password --type SecureString --value "$GPW" --overwrite
unset GPW
```
3. Triển khai (thay hai địa chỉ email):
```
aws cloudformation deploy --stack-name chatbot-mailer \
  --template-file infra/chatbot_mailer.yaml --capabilities CAPABILITY_IAM \
  --parameter-overrides GmailUser=GMAIL_GUI@gmail.com MailTo=EMAIL_NHAN@gmail.com
```
(Không được tạo IAM role: thêm `ExistingRoleArn=<arn>`; role cần `ssm:GetParameter` trên `/chatbot/gmail_app_password`.)
4. Thử bằng sự kiện giả, hộp thư phải nhận mail `[Chatbot] Khach can ho tro - HO_TEST`:
```
aws events put-events --entries '[{"Source":"chatbot.orchestrator","DetailType":"HumanHandoverRequested","Detail":"{\"ticket_id\":\"HO_TEST\",\"session_id\":\"s1\",\"user_id\":\"U1\",\"reason\":\"test\",\"question\":\"Toi can gap nhan vien\",\"history_text\":\"Khach: xin chao | Bot: chao ban\"}"}]'
aws logs tail /aws/lambda/chat-handover-mailer --since 5m
```
Lỗi thường gặp: `Application-specific password required` hoặc `Username and Password not accepted` (sai Gmail hoặc chưa dùng mật khẩu ứng dụng). Gmail giới hạn khoảng 500 thư mỗi ngày, đủ cho thông báo handover (có cooldown 10 phút mỗi phiên).

## Bước 5. Nạp dữ liệu và tạo vector
Upload `export.zip` vào CloudShell của tài khoản MỚI, rồi:
```
unzip -o export.zip
python3 migrate_data.py import --src export
pip install boto3 google-genai
export VECTOR_BUCKET=TEN_BUCKET
export GEMINI_SSM_PARAM=/chatbot/gemini_api_key
python3 scripts/build_vector_snapshot.py --docs-dir export/kb_docs --upload
```
Script đọc sản phẩm từ bảng `Products` vừa nạp và ghi `vectors/kb.json`, `vectors/products.json` vào bucket mới.
Chọn lại ngưỡng điểm (điểm có thể lệch do dữ liệu mới):
```
python3 scripts/build_vector_snapshot.py --calibrate out/kb.json out/products.json
```
Gửi kết quả cho mình nếu cần chọn lại `KB_MIN_SCORE`, `PRODUCT_MIN_SCORE`. Đổi bằng cách cập nhật tham số `KbMinScore`, `ProductMinScore` và chạy lại bước 4.

## Bước 6. Kiểm thử
1. Thử warmup trong console: Lambda → `chat-orchestrator-v2` → Test → event `{"warmup": true}`. Log phải có `TIMING vector_load ... (27 muc)` và `embed_ok=True`.
2. Trong `test_chatbot_answers.ipynb`, đổi địa chỉ WebSocket thành `WebSocketUrl` mới và chạy toàn bộ.
3. Gửi câu "Tôi muốn gặp nhân viên" và kiểm tra email Gmail có đủ mã yêu cầu, khách, lý do, câu hỏi, lịch sử (phiên mới chỉ có một câu thì lịch sử ghi chưa có tin nhắn trước). Nếu không có thư, xem `aws logs tail /aws/lambda/chat-handover-mailer --since 10m`.

## Bước 6b. Cập nhật image mới (ví dụ v6)
CloudShell không có repo: tải `chat_orchestrator_v2.py`, `Dockerfile.v2`, `requirements.v2.txt` lên CloudShell (Actions → Upload file), cùng một thư mục, rồi:
```bash
ACCOUNT=<ACCOUNT_ID>; REGION=ap-southeast-1
REPO=$ACCOUNT.dkr.ecr.$REGION.amazonaws.com/chat-orchestrator-v2
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ACCOUNT.dkr.ecr.$REGION.amazonaws.com
docker build -f Dockerfile.v2 -t $REPO:v6 . && docker push $REPO:v6
aws lambda update-function-code --function-name chat-orchestrator-v2 --image-uri $REPO:v6 --region $REGION
aws lambda wait function-updated --function-name chat-orchestrator-v2 --region $REGION
```
`update-function-code` không đổi biến môi trường. Muốn sửa biến thì đọc `get-function-configuration` rồi gửi lại TOÀN BỘ biến (lệnh `--environment` thay thế hết). Quay lại bản cũ: chạy lại `update-function-code` với tag cũ.

## Bước 7. Giám sát
Dùng lại `infra/chatbot_ops.yaml`:
```
aws cloudformation deploy --template-file infra/chatbot_ops.yaml --stack-name chatbot-ops \
  --region ap-southeast-1 \
  --parameter-overrides AlertEmail=email@example.com MonthlyBudgetUSD=10 WebSocketApiId=<WebSocketApiId trong Outputs>
```
Cần quyền Budgets (policy 08).

## Bước 8. Sau khi tài khoản mới chạy ổn
- Cập nhật `README.md`: địa chỉ WebSocket mới, tài khoản mới.
- Với tài khoản CŨ: sao lưu OpenSearch, xóa collection và các policy; xóa các Lambda, API, bảng, bucket nếu không dùng nữa; xóa khóa API cũ trên Drive.
- Không gửi khóa Gemini hay khóa truy cập AWS qua chat, email hay file.

## Phụ lục. Nếu leader tạo sẵn role
Hai role dùng chung trust policy `iam/12-trust-policy-lambda.json`. Permissions: `iam/11-runtime-role-receiver.json` cho role receiver và `iam/10-runtime-role-orchestrator.json` cho role orchestrator (thay `<ACCOUNT_ID>`, `<TEN_BUCKET>`, `<API_ID>` có thể để `*` ở lần đầu). Dán ARN hai role vào tham số `ExistingReceiverRoleArn`, `ExistingOrchestratorRoleArn`.
