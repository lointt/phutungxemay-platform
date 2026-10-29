# HẠ TẦNG DỰ ÁN HỆ THỐNG THƯƠNG MẠI ĐIỆN TỬ PHỤ TÙNG XE MÁY (TERRAFORM IaC)

Thư mục này chứa toàn bộ mã nguồn **Infrastructure as Code (IaC)** viết bằng **HashiCorp Terraform** để quản lý và tự động hóa toàn bộ tài nguyên Serverless trên AWS cho đồ án thực tập.

---

## 1. Cấu trúc thư mục

```text
terraform/
├── providers.tf             # Cấu hình AWS Provider (ap-southeast-1) và phiên bản Terraform
├── variables.tf             # Định nghĩa các biến cấu hình (region, bucket names, pool names,...)
├── terraform.tfvars.example # File mẫu giá trị biến thực tế
├── s3.tf                    # Khung 1: S3 Hosting (_next/static) & S3 Product Images + OAC
├── cognito.tf               # Khung 1: Cognito User Pool, Web App Client, Groups (Admins, Customers)
├── lambda_frontend.tf       # Khung 1: Lambda NextjsServerHandler (Node.js 22.x, Streaming SSR)
├── cloudfront.tf            # Khung 1: CloudFront Distribution (4 Behaviors) + CloudFront Function strip-api-prefix
├── dynamodb.tf              # Khung 2 & 3: 5 Bảng DynamoDB On-Demand (Products, Orders, Carts, Users, ChatSessions)
├── sqs.tf                   # Khung 2: Các SQS Queues & Dead Letter Queues (Inventory, Shipping, Notification)
├── apigateway_rest.tf       # Khung 2: API Gateway REST API kết nối Backend Microservices
├── apigateway_ws.tf         # Khung 3: API Gateway WebSocket API cho Chatbot RAG thời gian thực
├── outputs.tf               # Đầu ra: CloudFront URL, S3 Bucket Names, Cognito Pool ID, API URLs...
├── import.tf.example        # Mẫu khối import tài nguyên AWS đang hoạt động vào state
└── README.md                # Tài liệu hướng dẫn sử dụng và kiểm thử
```

---

## 2. Hướng dẫn cài đặt Terraform trên Windows

Nếu máy tính chưa có lệnh `terraform`, bạn có thể cài đặt bằng một trong các cách sau:

### Cách 1: Dùng Windows Package Manager (Khuyên dùng)
Mở PowerShell (Run as Administrator) và chạy:
```powershell
winget install HashiCorp.Terraform
```
Sau đó tắt terminal và mở lại để biến môi trường `PATH` cập nhật.

### Cách 2: Tải trực tiếp Binary từ HashiCorp
1. Truy cập [https://developer.hashicorp.com/terraform/install](https://developer.hashicorp.com/terraform/install).
2. Tải bản **Windows AMD64** (dạng file `.zip`).
3. Giải nén file `terraform.exe` vào một thư mục (ví dụ `C:\terraform`).
4. Thêm `C:\terraform` vào biến môi trường `Path` của Windows.

Kiểm tra cài đặt thành công:
```powershell
terraform -version
```

---

## 3. Quy trình vận hành Terraform

### Bước 1: Khởi tạo thư mục (Init)
Tải các AWS Provider plugins cần thiết:
```powershell
cd terraform
terraform init
```

### Bước 2: Kiểm tra cú pháp (Validate & Format)
Đảm bảo toàn bộ cấu hình chuẩn chỉ:
```powershell
terraform fmt
terraform validate
```

### Bước 3: Xem trước thay đổi (Plan)
Terraform sẽ so sánh cấu hình hiện tại với AWS và hiển thị những gì sẽ được tạo hoặc cập nhật:
```powershell
terraform plan
```

### Bước 4: Triển khai hạ tầng (Apply)
Khi cần triển khai môi trường mới hoặc cập nhật cấu hình:
```powershell
terraform apply
```

---

## 4. An toàn & Zero-Downtime

- **Không ảnh hưởng website đang chạy:** Việc thêm mã nguồn Terraform vào thư mục dự án và chạy `terraform plan` hoàn toàn **không làm gián đoạn** hoạt động của website `https://d1ksuy3hfmko20.cloudfront.net`.
- **Serverless $0.00 Idle Cost:** Toàn bộ tài nguyên được cấu hình theo triết lý Pay-as-you-go (DynamoDB On-Demand, Lambda, S3, API Gateway), không duy trì bất kỳ NAT Gateway hay server cố định nào, tối ưu 100% chi phí.
