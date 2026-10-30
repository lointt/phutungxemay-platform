# 🏍️ Phụ Tùng Xe Máy Platform (phutungxemay-platform)

Hệ thống thương mại điện tử chuyên cung cấp phụ tùng xe máy chính hãng toàn diện. Dự án được xây dựng theo kiến trúc **AWS Serverless 100%**, tối ưu hóa chi phí vận hành (tiệm cận 0đ ở quy mô vừa), độ trễ cực thấp và khả năng mở rộng không giới hạn.

> **Lưu ý kiến trúc:** 
> - **Khung 2 (Website Backend & Event-Driven)**: Đã hoàn thiện và sẵn sàng cho môi trường Production/Replica gồm 5 REST Services, 3 Event Workers, EventBridge, SQS + DLQ và DynamoDB.
> - **Khung 3 (Chatbot Kỹ Sư AI)**: Đang trong quá trình tối ưu hóa cấu trúc tiết kiệm chi phí (thay thế cho OpenSearch) và sẽ được tích hợp ở giai đoạn tiếp theo.

---

## 🏛️ Kiến Trúc Hệ Thống Tổng Thể (Fullstack Serverless Architecture)

```
                              [Khách hàng / Trình duyệt]
                                         │
                                         ▼
                     [CloudFront CDN: d1yvm1htsd670r.cloudfront.net]
                                ├── /_next/* ──► [Amazon S3: Static Assets & Media]
                                ├── / (SSR) ───► [AWS Lambda SSR: NextjsServerHandler (Node.js 22)]
                                └── /api/* ────► [CloudFront Function: strip /api]
                                                       │
                                                       ▼
                                    [Amazon API Gateway REST (prod)]
                                            │ (Cognito Authorizer)
                    ┌───────────────┬───────┴───────┬──────────────┬──────────────┐
                    ▼               ▼               ▼              ▼              ▼
             [CatalogService] [CartService]  [OrderService] [PaymentWebhook] [UserProfile]
                    │               │               │              │              │
                    ▼               ▼               ▼              ▼              ▼
               [Products]        [Carts]         [Orders]       [Orders]        [Users]
                                                    │              │
                                                    ▼              ▼
                                      [Amazon EventBridge Bus]
                                                    │
                                ┌───────────────────┼───────────────────┐
                                ▼                   ▼                   ▼
                        [Inventory Queue]   [Shipping Queue]    [Notification Queue]
                                │ (+ DLQ)           │ (+ DLQ)           │ (+ DLQ)
                                ▼                   ▼                   ▼
                        [InventoryWorker]   [ShippingWorker]    [NotificationWorker]
                          (Trừ/Hoàn kho)     (Tạo mã GHN)        (Gmail SMTP)
```

### Điểm nổi bật về công nghệ:
- **Frontend**: Next.js 16 (App Router, Server & Client Components, Streaming SSR, Tailwind CSS v4).
- **Deployment Adapter**: `@opennextjs/aws` v4 (tách biệt static assets lên S3 và server runtime xử lý SSR động lên AWS Lambda Streaming Function URL).
- **Backend Microservices**: Python 3.12 chạy trên AWS Lambda, REST API Gateway và DynamoDB Single/Multi-table design.
- **Kiến trúc hướng sự kiện (Event-Driven)**: Amazon EventBridge phối hợp cùng Amazon SQS & Dead Letter Queues (DLQ) đảm bảo tin cậy 100% cho các tác vụ trừ kho, tạo vận đơn GHN và gửi email thông báo.
- **Cổng thanh toán & Vận chuyển**: VNPay Sandbox (HMAC-SHA512) và Giao Hàng Nhanh API v2 (Fuzzy Regex Match địa chỉ chuẩn).
- **Email thông báo**: Tích hợp trực tiếp qua **Gmail SMTP** (bảo mật SSL cổng 465 / TLS cổng 587).
- **Hạ tầng (IaC)**: Terraform quản lý 100% tài nguyên AWS.
- **CI/CD**: GitHub Actions tự động build & deploy cả Frontend và Backend độc lập.

---

## 📁 Cấu Trúc Monorepo

```text
phutungxemay-platform/
├── .github/
│   └── workflows/
│       ├── frontend.yml               # CI/CD tự động build OpenNext, sync S3 & update SSR Lambda
│       └── backend.yml                # CI/CD tự động đóng gói & cập nhật 8 Lambda Backend Python
├── frontend/                          # Mã nguồn Next.js Frontend
│   ├── app/                           # App Router (Customer & Admin routes)
│   ├── components/                    # UI Components dùng chung
│   ├── context/                       # React Contexts (AuthContext, CartContext)
│   ├── hooks/                         # Custom React Hooks
│   ├── lib/                           # API Client, Cognito Auth Helpers, Utils
│   ├── types/                         # TypeScript Data Models & API Contracts
│   ├── open-next.config.ts            # Cấu hình OpenNext build cho AWS Lambda
│   ├── package.json
│   └── tsconfig.json
├── backend/                           # Mã nguồn Python Backend Microservices
│   ├── services/                      # REST API Services (Đồng bộ)
│   │   ├── catalog/handler.py         # Xem, lọc, thêm/sửa/xóa phụ tùng
│   │   ├── cart/handler.py            # Thêm, sửa, xóa, tính tổng tiền giỏ hàng
│   │   ├── order/handler.py           # Đặt hàng (COD/VNPAY), xem đơn, cập nhật trạng thái
│   │   ├── payment_webhook/handler.py # Xác thực IPN VNPay HMAC-SHA512
│   │   └── user/handler.py            # Hồ sơ người dùng, sổ địa chỉ, Garage xe
│   ├── workers/                       # Event Workers (Bất đồng bộ từ SQS)
│   │   ├── inventory/handler.py       # Trừ kho nguyên tử (Atomic Counter), hoàn kho khi hủy
│   │   ├── shipping/handler.py        # Tích hợp GHN API v2 + Fuzzy Match địa chỉ Việt Nam
│   │   └── notification/handler.py    # Gửi email HTML xác nhận đơn qua Gmail SMTP
│   └── requirements.txt
├── terraform/                         # Infrastructure as Code (IaC)
│   ├── cloudfront.tf                  # CloudFront CDN Distribution, S3 OAC & API Gateway routing
│   ├── lambda_frontend.tf             # Lambda NextjsServerHandler SSR & Function URL Permissions
│   ├── lambda_backend.tf              # 8 Lambda Backend Functions, IAM Roles & SQS Triggers
│   ├── apigateway_rest.tf             # REST API Gateway, Routes, CORS & Cognito Authorizer
│   ├── dynamodb.tf                    # DynamoDB Tables (Products, Orders, Carts, Users)
│   ├── cognito.tf                     # Cognito User Pool, Web App Client, Groups (Admins, Customers)
│   ├── eventbridge.tf                 # Custom Event Bus & Routing Rules
│   ├── sqs.tf                         # SQS Queues & Dead Letter Queues (DLQ)
│   ├── s3.tf                          # S3 Frontend Hosting Bucket & Policies
│   ├── variables.tf                   # Khai báo biến môi trường
│   ├── outputs.tf                     # Xuất các IDs, Domain, URLs sau khi deploy
│   ├── providers.tf                   # Cấu hình AWS Provider (ap-southeast-1)
│   └── terraform.tfvars.example       # File mẫu cấu hình tham số
├── .gitignore
└── README.md
```

---

## 🛠️ Yêu Cầu Môi Trường (Prerequisites)

1. **Node.js**: Phiên bản `20.x` hoặc `22.x LTS` (khuyên dùng Node.js 22).
2. **Python**: Phiên bản `3.11` hoặc `3.12`.
3. **Terraform**: Phiên bản `>= 1.5.0`.
4. **AWS CLI v2**: Đã xác thực với tài khoản AWS:
   ```bash
   aws configure
   # Nhập AWS Access Key ID, Secret Access Key, Region: ap-southeast-1
   ```
5. **Git**: Phiên bản mới nhất.

---

## ☁️ 1. Hướng Dẫn Triển Khai Hạ Tầng Với Terraform

Toàn bộ hạ tầng Frontend và Backend được quản lý thống nhất trong thư mục `terraform/`.

### Bước 1: Di chuyển vào thư mục terraform
```bash
cd terraform
```

### Bước 2: Tạo file tham số `terraform.tfvars`
```bash
# Trên Windows PowerShell:
copy terraform.tfvars.example terraform.tfvars

# Trên Linux / macOS:
cp terraform.tfvars.example terraform.tfvars
```
Tùy chỉnh thông số phù hợp:
```hcl
aws_region          = "ap-southeast-1"
environment         = "replica"
project_name        = "phutungxemay"
hosting_bucket_name = "phutungxemay-frontend-replica-2026"
```

### Bước 3: Khởi tạo và Triển khai Hạ tầng
```bash
# 1. Tải AWS Provider
terraform init

# 2. Xem trước các tài nguyên sẽ được tạo (Phải đảm bảo 0 to destroy)
terraform plan

# 3. Triển khai lên AWS
terraform apply -auto-approve
```

Sau khi hoàn tất, Terraform sẽ in ra các **Outputs**:
- `cloudfront_domain_name`: Domain CloudFront (ví dụ: `d1yvm1htsd670r.cloudfront.net`).
- `cloudfront_distribution_id`: ID phân phối (ví dụ: `E1G24NW0051BXO`).
- `s3_hosting_bucket_name`: Tên S3 Bucket hosting static assets.
- `lambda_nextjs_function_name`: Tên Lambda SSR (`NextjsServerHandler-Replica`).
- `api_gateway_rest_endpoint`: Endpoint REST API Gateway.
- `cognito_user_pool_id`: ID của Cognito User Pool.
- `cognito_client_id`: ID của Cognito App Client.
- `event_bus_name`: Tên Event Bus (`ecommerce-event-bus-replica`).

---

## 💻 2. Hướng Dẫn Chạy Frontend Ở Local

### Bước 1: Cài đặt dependencies
```bash
cd frontend
npm install
```

### Bước 2: Cấu hình biến môi trường `.env.local`
Tạo file `frontend/.env.local`:
```env
NEXT_PUBLIC_CDN_BASE_URL=https://d1yvm1htsd670r.cloudfront.net
NEXT_PUBLIC_API_BASE_URL=https://d1yvm1htsd670r.cloudfront.net/api
NEXT_PUBLIC_COGNITO_USER_POOL_ID=<COGNITO_USER_POOL_ID_TU_OUTPUT>
NEXT_PUBLIC_COGNITO_CLIENT_ID=<COGNITO_CLIENT_ID_TU_OUTPUT>
```

### Bước 3: Chạy local server
```bash
npm run dev
```
Truy cập [http://localhost:3000](http://localhost:3000).

---

## 🚀 3. Hướng Dẫn Cấu Hình Tự Động Hóa CI/CD (GitHub Actions)

Dự án có 2 workflows độc lập trong `.github/workflows/`:
1. **`frontend.yml`**: Kích hoạt khi có thay đổi trong `frontend/**`. Tự động: Type Check $\rightarrow$ Build OpenNext $\rightarrow$ Sync S3 $\rightarrow$ Update Lambda SSR $\rightarrow$ Invalidate CloudFront.
2. **`backend.yml`**: Kích hoạt khi có thay đổi trong `backend/**`. Tự động: Package 8 module Python $\rightarrow$ Update 8 Lambda Functions $\rightarrow$ Invalidate CloudFront `/api/*`.

### Danh sách GitHub Secrets cần thiết lập:
Vào GitHub Repository $\rightarrow$ **Settings** $\rightarrow$ **Secrets and variables** $\rightarrow$ **Actions** $\rightarrow$ **New repository secret**:

| Tên Secret | Ý Nghĩa / Giá Trị Mẫu |
| :--- | :--- |
| `AWS_ACCESS_KEY_ID` | Access Key của IAM User |
| `AWS_SECRET_ACCESS_KEY` | Secret Access Key tương ứng |
| `AWS_REGION` | `ap-southeast-1` |
| `AWS_ENVIRONMENT_TITLE` | `Replica` |
| `AWS_S3_FRONTEND_BUCKET` | Output: `s3_hosting_bucket_name` |
| `AWS_LAMBDA_SERVER_NAME` | Output: `lambda_nextjs_function_name` |
| `CLOUDFRONT_DISTRIBUTION_ID` | Output: `cloudfront_distribution_id` |
| `NEXT_PUBLIC_CDN_BASE_URL` | Output: `https://<cloudfront_domain_name>` |
| `NEXT_PUBLIC_API_BASE_URL` | Output: `https://<cloudfront_domain_name>/api` |
| `NEXT_PUBLIC_COGNITO_USER_POOL_ID` | Output: `cognito_user_pool_id` |
| `NEXT_PUBLIC_COGNITO_CLIENT_ID` | Output: `cognito_client_id` |

---

## 📡 4. Backend REST API Specifications

| Method | Endpoint | Quyền hạn | Mô tả chức năng |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/products` | Public | Lấy danh sách phụ tùng (query param: `?category=...`) |
| `GET` | `/api/products/{id}` | Public | Xem thông tin chi tiết một phụ tùng |
| `POST` | `/api/products` | Admin | Thêm mới phụ tùng vào danh mục |
| `PUT` | `/api/products/{id}` | Admin | Sửa thông tin, giá bán, tồn kho phụ tùng |
| `DELETE` | `/api/products/{id}` | Admin | Xóa phụ tùng khỏi danh mục |
| `GET` | `/api/cart` | User / Guest | Lấy giỏ hàng hiện tại (hỗ trợ `userId` query/header) |
| `POST` | `/api/cart` | User / Guest | Thêm sản phẩm vào giỏ `{ "product_id": "...", "quantity": 1 }` |
| `PUT` | `/api/cart` | User / Guest | Sửa số lượng sản phẩm (số lượng = 0 là xóa) |
| `DELETE` | `/api/cart` | User / Guest | Xóa toàn bộ sản phẩm trong giỏ |
| `POST` | `/api/orders` | Customer | Tạo đơn hàng mới (COD hoặc VNPay URL) |
| `GET` | `/api/orders` | Customer / Admin | Xem danh sách đơn (Customer xem đơn của mình, Admin xem tất cả) |
| `GET` | `/api/orders/{id}` | Public / Auth | Tra cứu trạng thái đơn hàng và mã vận đơn GHN |
| `PUT` | `/api/orders/{id}` | Admin | Cập nhật trạng thái đơn và mã tracking thủ công |
| `GET/POST`| `/api/payment/vnpay/ipn`| Public / VNPay | Webhook tiếp nhận kết quả thanh toán từ VNPay Sandbox |
| `GET` | `/api/users/me` | Customer | Xem thông tin tài khoản và danh sách xe trong Garage |
| `PUT` | `/api/users/me` | Customer | Sửa họ tên, số điện thoại, địa chỉ nhận hàng mặc định |
| `POST` | `/api/users/me/garage` | Customer | Thêm xe máy mới vào Garage cá nhân |

---

## 📌 Các Cơ Chế Kỹ Thuật Đã Tối Ưu (Best Practices)

1. **Chuẩn hóa địa chỉ Fuzzy Match cho GHN**:
   - `ShippingWorker` tích hợp bộ từ điển chuẩn hóa Quận/Huyện TP.HCM và các tỉnh thành Việt Nam, tự động bóc tách địa chỉ không dấu/có dấu để sinh mã vận đơn thật với GHN API v2.
2. **Xác thực chữ ký số VNPay**:
   - Thuật toán băm bảo mật HMAC-SHA512 chuẩn xác, hỗ trợ đồng thời redirect giao diện và webhook IPN ngầm với cơ chế Idempotency chống cộng dồn đơn hàng trùng lặp.
3. **Trừ kho nguyên tử (Atomic Counter)**:
   - `InventoryWorker` sử dụng `ConditionExpression: "stock >= :qty"` để đảm bảo số lượng tồn kho không bao giờ bị âm ngay cả khi có lượng lớn đơn hàng đồng thời (Race Condition).
4. **Email hóa đơn HTML chuyên nghiệp qua Gmail SMTP**:
   - `NotificationWorker` gửi trực tiếp qua Gmail SMTP (cổng 465 SSL, cổng 587 TLS dự phòng), gửi hóa đơn HTML định dạng bảng sản phẩm rõ nét kèm hotline hỗ trợ.

---

## 📄 License
Dự án được bảo lưu mọi quyền bởi đội ngũ phát triển **Phụ Tùng Xe Máy Platform**.
