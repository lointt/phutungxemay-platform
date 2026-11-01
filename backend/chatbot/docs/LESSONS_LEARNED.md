# Bài học rút ra khi chuyển sang bản không dùng OpenSearch và sang tài khoản mới

## Kiến trúc và chi phí
- Với khoảng vài chục sản phẩm và vài tài liệu, vector lưu ở S3 và nạp vào RAM Lambda đủ dùng; bỏ OpenSearch Serverless giúp cold start giảm từ 150-295 giây xuống khoảng 7 giây và cắt chi phí cố định.
- Ngưỡng điểm (cosine với Gemini 768 chiều) phải hiệu chỉnh lại mỗi khi đổi dữ liệu hoặc mô hình (`build_vector_snapshot.py --calibrate`). Giá trị đang dùng: KB 0.67, sản phẩm 0.45. Khi không embed được, tìm từ khóa dùng ngưỡng riêng `KB_MIN_KW` (0.4).

## Gemini
- `504 DEADLINE_EXCEEDED` và `503 UNAVAILABLE` xuất hiện vào buổi tối ở gói miễn phí (cả ba mô hình cùng lỗi); sáng hôm sau trở lại bình thường. Không phải lỗi của hệ thống.
- `429 RESOURCE_EXHAUSTED` xảy ra với mô hình preview ở gói miễn phí; không dùng mô hình preview làm mô hình chính.
- Chế độ dự phòng (liệt kê sản phẩm thô) giữ cho chatbot vẫn trả lời khi Gemini quá tải; test phải tính câu `degraded` là chưa đạt.
- Trước demo thật: cân nhắc bật thanh toán cho khóa Gemini, làm nóng Lambda 10-15 phút trước và có video dự phòng.

## Công cụ giỏ hàng (function calling)
- Không ghi "từ 1 đến 10" trong mô tả tham số số lượng: Gemini tự giảm 50 xuống 10 và gọi công cụ, bỏ qua kiểm tra tồn kho. Mô tả đúng: giữ nguyên con số của khách, công cụ tự kiểm tra.
- Thêm chốt chặn trong code (sản phẩm đã bị từ chối vì số lượng thì không cho thử lại trong cùng lượt) và dặn trong lời nhắc hệ thống.
- Kiểm tra `status` sản phẩm không phân biệt hoa thường (bảng của leader dùng `"active"`).

## Dùng chung tài khoản
- Dùng `CreateTables=false` khi bảng đã tồn tại và đang dùng cho ứng dụng thật. Không chạy lệnh nhập dữ liệu vào bảng thật.
- Test ghi giỏ hàng vào bảng thật: dùng `user_id` riêng (`TEST-NOTEBOOK`) và xóa sau khi chạy.
- CloudFormation cần đủ quyền theo từng dịch vụ (EventBridge, CloudFormation, Budgets). Dùng `preflight.sh` để biết thiếu gì trước khi deploy.
- `budgets:ModifyBudget` là quyền riêng; nếu thiếu thì deploy stack giám sát với `CreateBudget=false`.

## Thông báo chuyển nhân viên
- Mẫu InputTransformer của EventBridge gửi sang SNS email: xuống dòng `\n` hiển thị nguyên văn. Dùng mẫu một dòng ngăn cách bằng ` | `.

- Gmail SMTP thay SNS: thư SNS luôn mang nhãn "AWS Notification". Lambda `chat-handover-mailer` dùng `smtplib.SMTP_SSL` (smtp.gmail.com:465) với mật khẩu ứng dụng trong SSM. Với `EmailMessage` (Python 3.12) phải gán tiêu đề và người gửi bằng chuỗi thường; truyền đối tượng `email.header.Header` gây `TypeError: 'Header' object is not subscriptable`.

## Dọn tài khoản cũ
- Khi xóa OpenSearch Serverless, collection có deletion protection phải tắt trước (console) rồi mới xóa được. Không đưa lệnh xóa collection và lệnh xóa policy vào cùng một khối: policy bị xóa trước thì không đọc được dữ liệu để sao lưu. Thứ tự đúng: sao lưu index, tắt bảo vệ, xóa collection, kiểm tra hết, rồi xóa policy.

## CloudShell
- Luôn `export AWS_REGION=ap-southeast-1`; nhập khóa bằng `read -s` rồi `aws ssm put-parameter` (không dán khóa vào chuỗi nhắc); `export AWS_PAGER=""` để tránh bị kẹt trong `less`.

## Cập nhật image
- Biến môi trường Lambda có thể không chứa mọi ngưỡng: biến vắng thì dùng mặc định trong code. Đọc `get-function-configuration` trước khi nghĩ rằng một biến đang có giá trị nào đó.
- Prompt quá chặt ("luôn đối chiếu xe") làm bot hỏi lại cả những câu chỉ hỏi giá. Tách rõ: hỏi thông tin thì trả lời ngay, mua hoặc thêm giỏ mới cần xác nhận xe.
- Khi Gemini quá tải, chế độ dự phòng phải chọn đúng nguồn: câu hỏi chính sách trả tài liệu, không liệt kê sản phẩm.
