# 🏍️ Phụ Tùng Xe Máy Platform (phutungxemay-platform)

Hệ thống thương mại điện tử chuyên cung cấp phụ tùng xe máy chính hãng kết hợp Trợ lý Kỹ sư AI (Chatbot RAG) tư vấn kỹ thuật trực tuyến. Dự án được xây dựng theo kiến trúc **AWS Serverless 100%**, tối ưu hóa chi phí vận hành (tiệm cận 0đ ở quy mô vừa), độ trễ cực thấp và khả năng mở rộng không giới hạn.

---

## 🏛️ Kiến Trúc Hạ Tầng Frontend (Frontend Serverless Architecture)

```
[Khách hàng / Trình duyệt]
           │
           ▼
[Amazon CloudFront CDN (ap-southeast-1)] ── OAC ──► [Amazon S3: Static Assets (_next/static/*)]
           │ (Cache-Control: public, max-age=31536000, immutable)
           │
           └──────────────────────────────► [AWS Lambda SSR: NextjsServerHandler (Node.js 22 + OpenNext)]
                                             (Response Streaming Function URL - Auth: NONE)
```

### Điểm nổi bật về công nghệ:
- **Frontend Framework**: Next.js 16 (App Router, Server & Client Components, Streaming SSR, Tailwind CSS v4).
- **Deployment Adapter**: `@opennextjs/aws` v4 (tách biệt hoàn toàn phần static assets lên S3 và server runtime xử lý SSR động lên AWS Lambda Streaming Function URL).
- **Hạ tầng (IaC)**: Terraform quản lý độc lập 100% tài nguyên hạ tầng Frontend (S3 Bucket Hosting, Lambda SSR Function URL, CloudFront Distribution CDN, IAM Execution Role).
- **CI/CD Tự động hóa**: GitHub Actions tự động kiểm tra Type Check TypeScript, Build OpenNext, đồng bộ S3, cập nhật mã nguồn Lambda và Invalidate Cache CloudFront.

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
│   ├── context/                # React Contexts (AuthContext, CartContext)
│   ├── hooks/                  # Custom React Hooks
│   ├── lib/                    # API clients, Cognito auth helpers, utils
│   ├── types/                  # TypeScript Data Models & Contracts
│   ├── open-next.config.ts     # Cấu hình OpenNext build cho AWS Lambda Streaming
│   ├── package.json
│   └── tsconfig.json
├── terraform/                  # Mã nguồn Hạ tầng Frontend Độc lập (IaC)
│   ├── cloudfront.tf           # CloudFront Distribution, Cache Policies & S3 OAC
│   ├── lambda_frontend.tf      # Lambda NextjsServerHandler SSR, Function URL & Permissions
│   ├── s3.tf                   # S3 Hosting Bucket (_next/static/*) & Public Access Block
│   ├── variables.tf            # Khai báo biến Terraform cho Frontend
│   ├── outputs.tf              # Xuất các endpoint, Bucket Name, CloudFront Domain & ID
│   ├── providers.tf            # Cấu hình AWS Provider (ap-southeast-1)
│   └── terraform.tfvars.example# Mẫu cấu hình tham số môi trường
├── .gitignore                  # Bảo vệ mã nguồn, loại trừ file state, env và node_modules
└── README.md
```

---

## 🛠️ Yêu Cầu Môi Trường (Prerequisites)

Để chạy dự án và triển khai thành công, máy tính của bạn cần cài đặt:
1. **Node.js**: Phiên bản `20.x` hoặc `22.x LTS` (khuyên dùng Node.js 22).
2. **Terraform**: Phiên bản `>= 1.5.0`.
3. **AWS CLI v2**: Đã xác thực với tài khoản AWS có đủ quyền triển khai:
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
Tạo file `.env.local` bên trong thư mục `frontend/` với nội dung:
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

## ☁️ 2. Hướng Dẫn Triển Khai Hạ Tầng Với Terraform (Infrastructure Deployment)

Thư mục `terraform/` được thiết kế độc lập, chỉ tạo hạ tầng cho Frontend mà không phụ thuộc hoặc làm ảnh hưởng tới bất kỳ tài nguyên Backend nào.

### Bước 1: Di chuyển vào thư mục terraform
```bash
cd terraform
```

### Bước 2: Tạo file `terraform.tfvars`
Sao chép từ file mẫu `terraform.tfvars.example`:
```bash
# Trên Windows PowerShell:
copy terraform.tfvars.example terraform.tfvars

# Trên Linux / macOS:
cp terraform.tfvars.example terraform.tfvars
```
Tùy chỉnh các thông số phù hợp:
```hcl
aws_region          = "ap-southeast-1"
environment         = "replica"
project_name        = "phutungxemay"
hosting_bucket_name = "phutungxemay-frontend-replica-2026"
```

### Bước 3: Khởi tạo và Áp dụng Hạ tầng
```bash
# 1. Tải AWS Provider
terraform init

# 2. Xem trước kế hoạch tạo tài nguyên (Phải đảm bảo 0 to destroy)
terraform plan

# 3. Tạo tài nguyên lên AWS
terraform apply -auto-approve
```

Sau khi hoàn tất, Terraform sẽ in ra các **Outputs** quan trọng:
- `cloudfront_domain_name`: Domain CloudFront mới (ví dụ: `d1yvm1htsd670r.cloudfront.net`).
- `cloudfront_distribution_id`: ID phân phối (ví dụ: `E1G24NW0051BXO`).
- `s3_hosting_bucket_name`: Tên S3 Bucket (ví dụ: `phutungxemay-frontend-replica-2026`).
- `lambda_nextjs_function_name`: Tên Lambda SSR (ví dụ: `NextjsServerHandler-Replica`).
- `lambda_nextjs_function_url`: Endpoint Function URL streaming của Lambda.

---

## 🚀 3. Hướng Dẫn Cấu Hình CI/CD Tự Động (GitHub Actions)

Dự án đã tích hợp sẵn workflow tự động hóa tại [`.github/workflows/frontend.yml`](.github/workflows/frontend.yml). Mỗi khi bạn đẩy code (`git push`) lên nhánh `main` tác động tới `frontend/`, GitHub Actions sẽ tự động thực hiện: Type Check $\rightarrow$ Build OpenNext $\rightarrow$ Sync S3 $\rightarrow$ Update Lambda $\rightarrow$ Invalidate CloudFront.

### Thiết lập GitHub Secrets:
Trên kho GitHub của bạn:
Vào **Settings** $\rightarrow$ **Secrets and variables** $\rightarrow$ **Actions** $\rightarrow$ bấm nút xanh **New repository secret** và thêm các secrets sau:

| Tên Secret | Giá Trị Lấy Từ Đâu | Ví Dụ Mẫu |
| :--- | :--- | :--- |
| `AWS_ACCESS_KEY_ID` | IAM User Credentials | `AKIA2ZNUATKG...` |
| `AWS_SECRET_ACCESS_KEY` | IAM User Credentials | `wJalrXUtnFEMI/K7MDENG/bPxRfiCY...` |
| `AWS_REGION` | Khu vực AWS | `ap-southeast-1` |
| `AWS_S3_FRONTEND_BUCKET` | Terraform Output `s3_hosting_bucket_name` | `phutungxemay-frontend-replica-2026` |
| `AWS_LAMBDA_SERVER_NAME` | Terraform Output `lambda_nextjs_function_name`| `NextjsServerHandler-Replica` |
| `CLOUDFRONT_DISTRIBUTION_ID` | Terraform Output `cloudfront_distribution_id`| `E1G24NW0051BXO` |
| `NEXT_PUBLIC_CDN_BASE_URL` | Terraform Output `cloudfront_domain_name` | `https://d1yvm1htsd670r.cloudfront.net` |
| `NEXT_PUBLIC_API_BASE_URL` | REST API Backend URL | `https://d1ksuy3hfmko20.cloudfront.net/api` |
| `NEXT_PUBLIC_COGNITO_USER_POOL_ID`| Cognito User Pool ID | `ap-southeast-1_ecJz9V8QY` |
| `NEXT_PUBLIC_COGNITO_CLIENT_ID`| Cognito Client ID | `7rbclbi7o4vun1dpe6k2glmel7` |
| `NEXT_PUBLIC_WEBSOCKET_URL` | WebSocket URL cho Chatbot RAG | `wss://9trjqwwev1.execute-api.ap-southeast-1.amazonaws.com/production` |

### Kích hoạt Pipeline:
1. Vào tab **Actions** trên GitHub.
2. Chọn workflow **Frontend CI/CD Pipeline** $\rightarrow$ nhấn **Run workflow** (hoặc chỉ cần thực hiện `git push` một thay đổi code).
3. Sau khoảng 1 phút, pipeline hoàn thành với dấu tích xanh $\checkmark$.
4. Mở trình duyệt truy cập domain CloudFront của bạn: Website sẽ hiển thị mượt mà với SSR streaming và static assets từ S3!

---

## 📌 Các Lưu Ý Quan Trọng Khi Triển Khai (Troubleshooting Guide)

1. **Tránh lỗi 403 Forbidden của Lambda Function URL:**
   - AWS Lambda yêu cầu 2 quyền độc lập khi mở Function URL dạng public (`NONE`):
     - `lambda:InvokeFunctionUrl`: Quyền gọi vào URL.
     - `lambda:InvokeFunction` (với `--invoked-via-function-url`): Quyền cho phép Lambda thực thi code khi được kích hoạt qua URL.
   - File `terraform/lambda_frontend.tf` trong dự án đã cấu hình đầy đủ cả 2 resource permission này để tự động cấp phép khi chạy `terraform apply`.
2. **Tránh lỗi Git Submodule:**
   - Khi khởi tạo Next.js, nếu trong thư mục `frontend/` vô tình có thư mục ẩn `.git`, hãy xóa nó trước khi add vào monorepo bên ngoài để tránh bị nhận nhầm thành submodule rỗng.
3. **TypeScript Type Safety:**
   - Luôn sử dụng kiểu dữ liệu React chuẩn mực (`{ children: React.ReactNode }`) cho `RootLayout` trong `frontend/app/layout.tsx` để vượt qua quy trình Type Check tự động của CI/CD.

---

## 📄 License
Dự án được phát triển và bảo lưu mọi quyền bởi đội ngũ **Phụ Tùng Xe Máy Platform**.
