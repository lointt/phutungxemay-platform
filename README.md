# 🏍️ Phụ Tùng Xe Máy Platform (phutungxemay-platform)

Hệ thống thương mại điện tử chuyên cung cấp phụ tùng xe máy chính hãng kết hợp Trợ lý Kỹ sư AI (Chatbot RAG) tư vấn kỹ thuật trực tuyến. Dự án được xây dựng theo kiến trúc **AWS Serverless 100%**, tối ưu hóa chi phí vận hành (tiệm cận 0đ ở quy mô vừa), độ trễ cực thấp và khả năng mở rộng không giới hạn.

---

## 🏛️ Kiến Trúc Hệ Thống (Architecture Overview)

```
[Khách hàng / Trình duyệt]
           │
           ▼
[Amazon CloudFront CDN (ap-southeast-1)] ── OAC ──► [Amazon S3: Static Assets & Images]
           │ (Cache-Control: public, max-age=31536000, immutable)
           ├──────────────────────────────► [AWS Lambda SSR: NextjsServerHandler (Node.js 22 + OpenNext)]
           │                                 (Response Streaming Function URL)
           │
           ├─► /api/* ────────────────────► [Amazon API Gateway REST (prod)] ──► [Microservices Lambdas]
           │                                                                    ├── OrderService
           │                                                                    ├── CartService
           │                                                                    └── PaymentWebhook
           │
           └─► wss://... ─────────────────► [Amazon API Gateway WebSocket] ──► [Chatbot RAG Lambda]
```

### Điểm nổi bật về công nghệ:
- **Frontend Framework**: Next.js 16 (App Router, Server & Client Components, Streaming SSR, Tailwind CSS v4).
- **Deployment Adapter**: `@opennextjs/aws` v4 (tách biệt hoàn toàn phần static assets lên S3 và server runtime xử lý SSR động lên AWS Lambda Streaming).
- **Hạ tầng (IaC)**: Terraform quản lý 100% tài nguyên AWS (CloudFront, S3, Lambda, API Gateway, Cognito, DynamoDB, SQS, SNS, EventBridge).
- **CI/CD**: GitHub Actions tự động kiểm tra Type, Build OpenNext, đồng bộ S3, cập nhật Lambda và Invalidate Cache CloudFront.

---

## 📁 Cấu Trúc Monorepo

```text
phutungxemay-platform/
├── .github/
│   └── workflows/
│       └── frontend.yml        # CI/CD Pipeline tự động build & deploy frontend lên AWS
├── frontend/                   # Mã nguồn Next.js Frontend
│   ├── app/                    # Next.js App Router (Customer & Admin routes)
│   ├── components/             # Reusable UI Components
│   ├── context/                # React Contexts (AuthContext, CartContext, etc.)
│   ├── hooks/                  # Custom React Hooks
│   ├── lib/                    # API clients, Cognito auth helpers, utils
│   ├── types/                  # TypeScript Data Models & Contracts
│   ├── open-next.config.ts     # Cấu hình OpenNext build cho AWS Lambda Streaming
│   ├── package.json
│   └── tsconfig.json
├── terraform/                  # Mã nguồn Infrastructure as Code (IaC)
│   ├── cloudfront.tf           # CloudFront Distribution, Cache Policies & OAC
│   ├── lambda_frontend.tf      # Lambda NextjsServerHandler SSR & Function URL
│   ├── s3.tf                   # S3 Hosting Bucket & S3 Product Images Bucket
│   ├── cognito.tf              # Amazon Cognito User Pool & App Client
│   ├── apigateway_rest.tf      # REST API Gateway (/api/*)
│   ├── apigateway_ws.tf        # WebSocket API Gateway (Chatbot RAG)
│   ├── dynamodb.tf             # DynamoDB Tables (Products, Orders, Carts, Users...)
│   ├── sqs.tf & sns.tf         # SQS Queue, DLQ và SNS Notifications
│   ├── variables.tf            # Khai báo biến Terraform
│   ├── outputs.tf              # Xuất các endpoint & ID tài nguyên sau deploy
│   └── providers.tf            # Cấu hình AWS Provider (ap-southeast-1)
├── scripts/                    # Scripts tiện ích (seeding data, background workers)
├── .gitignore
└── README.md
```

---

## 🛠️ Yêu Cầu Môi Trường (Prerequisites)

Để chạy dự án và triển khai thành công, máy tính của bạn cần cài đặt:
1. **Node.js**: Phiên bản `20.x` hoặc `22.x LTS` (khuyên dùng Node.js 22).
2. **Terraform**: Phiên bản `>= 1.5.0`.
3. **AWS CLI v2**: Đã xác thực với tài khoản AWS có đủ quyền:
   ```bash
   aws configure
   # Nhập AWS Access Key ID, Secret Access Key, Region: ap-southeast-1
   ```
4. **Git**: Phiên bản mới nhất.

---

## 💻 1. Hướng Dẫn Chạy Frontend Ở Local (Development)

### Bước 1: Di chuyển vào thư mục frontend
```bash
cd frontend
```

### Bước 2: Cài đặt dependencies
```bash
npm install
```

### Bước 3: Tạo file cấu hình biến môi trường
Tạo file `.env.local` bên trong thư mục `frontend/` với nội dung mẫu:
```env
NEXT_PUBLIC_CDN_BASE_URL=https://d1ksuy3hfmko20.cloudfront.net
NEXT_PUBLIC_API_BASE_URL=https://d1ksuy3hfmko20.cloudfront.net/api
NEXT_PUBLIC_COGNITO_USER_POOL_ID=ap-southeast-1_ecJz9V8QY
NEXT_PUBLIC_COGNITO_CLIENT_ID=7rbclbi7o4vun1dpe6k2glmel7
NEXT_PUBLIC_WEBSOCKET_URL=wss://9trjqwwev1.execute-api.ap-southeast-1.amazonaws.com/production
```

### Bước 4: Khởi chạy local dev server
```bash
npm run dev
```
Mở trình duyệt truy cập: [http://localhost:3000](http://localhost:3000).

---

## ☁️ 2. Hướng Dẫn Triển Khai Hạ Tầng Với Terraform

Toàn bộ hạ tầng lưu trữ và vận hành frontend đã được định nghĩa bằng mã nguồn trong thư mục `terraform/`.

### Bước 1: Di chuyển vào thư mục terraform
```bash
cd terraform
```

### Bước 2: Tạo file `terraform.tfvars`
Sao chép từ file mẫu `terraform.tfvars.example`:
```bash
cp terraform.tfvars.example terraform.tfvars
```
Điều chỉnh các thông số phù hợp (nếu cần):
```hcl
aws_region  = "ap-southeast-1"
environment = "prod"
project_name = "phutungxemay"
```

### Bước 3: Khởi tạo và áp dụng hạ tầng
```bash
# 1. Tải các AWS providers
terraform init

# 2. Xem trước kế hoạch tạo tài nguyên
terraform plan

# 3. Tạo tài nguyên lên AWS
terraform apply -auto-approve
```

Sau khi hoàn tất, Terraform sẽ in ra các `Outputs` quan trọng:
- `cloudfront_domain_name`: Domain CloudFront (ví dụ: `d1ksuy3hfmko20.cloudfront.net`).
- `s3_frontend_bucket_name`: Bucket chứa static files (`phutungxemay-frontend-hosting-2026`).
- `lambda_nextjs_function_name`: Tên hàm SSR (`NextjsServerHandler`).

---

## 🚀 3. Hướng Dẫn Build & Deploy Frontend Thủ Công

Nếu bạn muốn deploy trực tiếp từ máy cá nhân lên AWS thông qua AWS CLI:

### Bước 1: Build mã nguồn bằng OpenNext
```bash
cd frontend
npm run build:open-next
```
Lệnh này sẽ biên dịch Next.js và sinh ra thư mục `.open-next/` gồm:
- `.open-next/assets`: Chứa toàn bộ file tĩnh (JS bundle, CSS, media, font).
- `.open-next/server-functions/default`: Chứa code Node.js xử lý SSR Lambda.

### Bước 2: Đồng bộ Static Assets lên S3
```bash
aws s3 sync .open-next/assets s3://phutungxemay-frontend-hosting-2026 --delete
```

### Bước 3: Đóng gói và cập nhật Lambda SSR
**Trên Windows (PowerShell):**
```powershell
Compress-Archive -Path .open-next\server-functions\default\* -DestinationPath function.zip -Force
aws lambda update-function-code --function-name NextjsServerHandler --zip-file fileb://function.zip
Remove-Item function.zip
```

**Trên Linux / macOS (Bash):**
```bash
cd .open-next/server-functions/default
zip -rq ../../../function.zip .
cd ../../..
aws lambda update-function-code --function-name NextjsServerHandler --zip-file fileb://function.zip
rm function.zip
```

### Bước 4: Xóa Cache CloudFront (Invalidation)
```bash
aws cloudfront create-invalidation --distribution-id E2E4BVXCBW1IXC --paths "/*"
```
Trang web sẽ lập tức cập nhật phiên bản mới nhất trên toàn cầu!

---

## 🔄 4. Hướng Dẫn Thiết Lập Tự Động Hóa CI/CD (GitHub Actions)

Dự án đã tích hợp sẵn workflow tự động hóa tại [`.github/workflows/frontend.yml`](.github/workflows/frontend.yml). Mỗi khi bạn đẩy code (`git push`) lên nhánh `main` có thay đổi trong thư mục `frontend/`, GitHub Actions sẽ tự động thực hiện quy trình Build $\rightarrow$ S3 $\rightarrow$ Lambda $\rightarrow$ Invalidate CloudFront.

### Cấu hình GitHub Secrets:
Truy cập kho mã nguồn trên GitHub:
`Settings` $\rightarrow$ `Secrets and variables` $\rightarrow$ `Actions` $\rightarrow$ `New repository secret` và thêm các secrets sau:

| Tên Secret | Ý Nghĩa / Giá Trị Mẫu |
| :--- | :--- |
| `AWS_ACCESS_KEY_ID` | AWS IAM Access Key có quyền S3, Lambda, CloudFront |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM Secret Access Key tương ứng |
| `AWS_REGION` | `ap-southeast-1` |
| `AWS_S3_FRONTEND_BUCKET` | `phutungxemay-frontend-hosting-2026` |
| `AWS_LAMBDA_SERVER_NAME` | `NextjsServerHandler` |
| `CLOUDFRONT_DISTRIBUTION_ID` | `E2E4BVXCBW1IXC` |
| `NEXT_PUBLIC_CDN_BASE_URL` | `https://d1ksuy3hfmko20.cloudfront.net` |
| `NEXT_PUBLIC_API_BASE_URL` | `https://d1ksuy3hfmko20.cloudfront.net/api` |
| `NEXT_PUBLIC_COGNITO_USER_POOL_ID` | `ap-southeast-1_ecJz9V8QY` |
| `NEXT_PUBLIC_COGNITO_CLIENT_ID` | `7rbclbi7o4vun1dpe6k2glmel7` |
| `NEXT_PUBLIC_WEBSOCKET_URL` | `wss://9trjqwwev1.execute-api.ap-southeast-1.amazonaws.com/production` |

---

## 🛡️ Tích Hợp Dịch Vụ Thứ 3 (3rd-Party Integrations)

- **Cổng thanh toán VNPAY**: Sandbox HMAC-SHA512 verification, tự động điều hướng sang trang kết quả đơn hàng.
- **Đơn vị vận chuyển Giao Hàng Nhanh (GHN)**: Tích hợp API v2 tính phí vận chuyển và tự động sinh mã vận đơn thật (Tracking Code) thông qua cơ chế chuẩn hóa địa chỉ thông minh (Fuzzy Regex Match) ở backend `ShippingWorker`. Miễn phí vận chuyển cho đơn hàng $\ge 500.000$ VNĐ.
- **Hệ thống Email Thông Báo**: Tích hợp Gmail SMTP và AWS SES thông báo trạng thái đơn hàng tức thời.
- **Dead Letter Queue (DLQ)**: Cơ chế bắt lỗi và phục hồi tin nhắn đơn hàng qua Amazon SQS DLQ.

---

## 📄 License
Dự án được bảo lưu mọi quyền bởi đội ngũ phát triển **Phụ Tùng Xe Máy Platform**.
