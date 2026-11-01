# Nhật ký làm việc (bản v2, không dùng OpenSearch)

```
================================================================================
14. CHUYỂN SANG TÀI KHOẢN CỦA LEADER VÀ BẢN V2 (27/10/2026)
================================================================================

Xong
- Bản v2 không dùng OpenSearch: vector trên S3 nạp vào bộ nhớ Lambda, Gemini embedding 768 chiều, hybrid cosine + BM25, giới hạn tần suất bằng DynamoDB, khóa Gemini trong SSM. Cold start đo được khoảng 6,8 s (trước đây 150-295 s).
- Tài khoản leader (<ACCOUNT_ID>, IAM user AI-Engineer): bộ chính sách triển khai 01-08 do leader cấp (07 và 08 được bổ sung sau kiểm tra preflight), tạo kho ECR, build và push image, stack CloudFormation `chatbot-v2` (CreateTables=false, dùng bảng Products/Carts/Users thật), stack giám sát `chatbot-ops` với 7 alarm.
- Dựng vector từ 26 sản phẩm thật và 5 tài liệu (27 đoạn KB); ngưỡng giữ KB 0.67 và sản phẩm 0.45 sau khi hiệu chỉnh.
- Sửa lỗi: so sánh status không phân biệt hoa thường (bảng leader dùng "active"); email chuyển nhân viên hiển thị một dòng; bot không tự giảm số lượng khi khách yêu cầu vượt tồn kho (sửa mô tả công cụ add_to_cart và thêm chốt chặn).
- Kiểm thử: chính sách, tư vấn sản phẩm, câu ngoài phạm vi, chuyển nhân viên (có email), thêm và xem giỏ, từ chối khi chưa đăng nhập; notebook test_chatbot_answers chạy trên URL mới.
- WebSocket mới: wss://eu9j8c0avi.execute-api.ap-southeast-1.amazonaws.com/dev/

Chưa xong
- AWS Budgets: thiếu quyền budgets:ModifyBudget, cần leader bổ sung vào policy 08 (hoặc thêm email vào ngân sách chung) rồi deploy lại chatbot-ops với CreateBudget=true.
- Xóa giỏ test USR_98765 trong bảng Carts của leader; đổi user_id trong notebook sang mã test riêng.
- Viết lại bộ câu hỏi notebook theo 26 sản phẩm thật; thay image_url giả (your-s3-bucket) bằng URL thật.
- Thông báo cho leader và frontend địa chỉ WebSocket mới; thay HandoverEmail bằng email nhân viên hỗ trợ.
- Sau vài ngày chạy ổn: sao lưu rồi xóa collection OpenSearch và policy ở tài khoản cũ (tài khoản cũ); hỏi team trước khi xóa RDS/EC2.
- Thử Lambda authorizer cho $connect trên API riêng; cân nhắc bật billing cho Gemini trước khi demo thật.
- Xóa file chứa access key cũ trên Google Drive; chuyển notebook 01-04 vào thùng rác sau khi xác nhận.
- Đổi khóa Gemini đã lộ trong ảnh chụp ngày 27/10 (đã tạo khóa mới, cần xóa khóa cũ trong Google AI Studio).

================================================================================
15. DỌN TÀI KHOẢN CŨ VÀ GỬI EMAIL QUA GMAIL SMTP (28/10/2026)
================================================================================

Xong
- Quyết định: chatbot v2 trên tài khoản leader là hệ thống chính; báo cáo chỉ mô tả v2 (v1 nhắc ngắn như lịch sử tối ưu: cold start 150-295 s xuống khoảng 7 s, bỏ chi phí cố định của OpenSearch).
- Tài khoản cũ: đã sao lưu index OpenSearch, tắt deletion protection, xóa collection `chatbot-kb-collection` và 3 policy; kiểm tra không còn collection hay policy. Các tài nguyên còn lại (Lambda, API `chatbot-ws`, ECR, S3 `team-chatbot-kb-dev-999`, SNS/EventBridge, bảng chatbot-sessions, IAM role, log group) giữ làm đường lui, xóa sau khoảng một tuần ổn định. Giữ nguyên Products/Users/Carts/Orders (dữ liệu ứng dụng, hỏi nhóm trước) và bucket CDK bootstrap.
- Email chuyển nhân viên đổi từ SNS sang Gmail SMTP: stack `chatbot-mailer` (Lambda `chat-handover-mailer` + rule EventBridge `chatbot-handover-mail-rule`), mật khẩu ứng dụng Gmail trong SSM `/chatbot/gmail_app_password`. Sửa lỗi Header (Python 3.12). Test bằng sự kiện giả và bằng chatbot thật đều nhận được thư đúng định dạng.
- Đã xóa subscription và topic SNS `chatbot-handover` ở tài khoản leader. Template `chatbot_stack.yaml` nay để SNS là tùy chọn (chỉ tạo khi điền `HandoverEmail`); đã cập nhật stack `chatbot-v2` bằng change set (chỉ gỡ HandoverRule, HandoverTopicPolicy, HandoverTopic, giữ nguyên các tham số cũ), trạng thái UPDATE_COMPLETE, chỉ còn rule `chatbot-handover-mail-rule`.

Chưa xong
- Chạy lại test buổi sáng khi Gemini ổn định (không có câu trả lời degraded); xóa giỏ test USR_98765 và TEST-NOTEBOOK.
- Hỏi leader: quyền budgets cho policy 08; email nhận handover thật; image_url thật; dữ liệu PROD_OIL_003 không nhất quán; frontend đổi sang WebSocket mới.
- Sau khoảng một tuần ổn định: xóa nốt Lambda, API, ECR, S3, SNS/EventBridge, bảng chatbot-sessions, IAM role và log group ở tài khoản cũ.
- Xóa khóa Gemini bị lộ trong Google AI Studio và tạo khóa mới; xóa file access key cũ trên Drive.
```

## 16. 30/10 – Bản v6 của chat-orchestrator-v2
- Prompt: hỏi giá/tồn kho thì trả lời ngay không bắt khai xe; sản phẩm Universal không hỏi xe; chỉ hỏi xe khi mua/thêm giỏ; không chèn tài liệu vào câu trả lời sản phẩm.
- fallback_answer: câu hỏi chính sách (bảo hành, đổi trả, vận chuyển...) trả đoạn KB trước (600 ký tự) thay vì liệt kê sản phẩm.
- KB_MIN_KW mặc định 0.4 (đồng bộ lại biến môi trường Lambda).
- Test offline: 39/39 đạt.
- Deploy v6 lên Lambda (image :v6, môi trường không có KB_MIN_KW nên dùng mặc định 0.4). Test sáng: sản phẩm 12/12, giỏ hàng đạt.
- Quy trình cập nhật image từ CloudShell: xem DEPLOY.md bước 6b.
- Test đầu cuối v6 hoàn tất 30/10: KB 6/6, sản phẩm 12/12, ngoài phạm vi 4/4, Garage, giỏ hàng, chuyển nhân viên (phiếu HO_20261030040828_7e43) đều đạt.
