#!/usr/bin/env bash
# ==============================================================================
# Script: scripts/deploy-aws.sh
# Mô tả: Đóng gói và triển khai Next.js lên AWS Serverless qua OpenNext
# Target:
#   - Static Assets -> AWS S3 (phutungxemay-frontend-hosting-2026)
#   - Server Runtime -> AWS Lambda (NextjsServerHandler)
#   - CDN Invalidation -> CloudFront (d1ksuy3hfmko20.cloudfront.net)
# ==============================================================================

set -euo pipefail

# Màu hiển thị console
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ------------------------------------------------------------------------------
# 1. Cấu hình thông số mặc định (cho phép override qua biến môi trường)
# ------------------------------------------------------------------------------
REGION="${AWS_REGION:-ap-southeast-1}"
S3_BUCKET="${S3_BUCKET:-phutungxemay-frontend-hosting-2026}"
LAMBDA_FUNCTION_NAME="${LAMBDA_FUNCTION_NAME:-NextjsServerHandler}"
CLOUDFRONT_DOMAIN="${CLOUDFRONT_DOMAIN:-d1ksuy3hfmko20.cloudfront.net}"
CLOUDFRONT_DISTRIBUTION_ID="${CLOUDFRONT_DISTRIBUTION_ID:-}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo -e "${BLUE}======================================================================${NC}"
echo -e "${CYAN}🚀 BẮT ĐẦU QUY TRÌNH DEPLOY NEXT.JS (OPENNEXT) LÊN AWS SERVERLESS${NC}"
echo -e "${BLUE}======================================================================${NC}"
echo -e "📁 Project Root    : ${PROJECT_ROOT}"
echo -e "🌏 AWS Region      : ${REGION}"
echo -e "🪣 S3 Bucket       : ${S3_BUCKET}"
echo -e "⚡ Lambda Function  : ${LAMBDA_FUNCTION_NAME}"
echo -e "🌐 CloudFront CNAME: ${CLOUDFRONT_DOMAIN}"
echo -e "${BLUE}----------------------------------------------------------------------${NC}"

# Kiểm tra công cụ cần thiết
command -v aws >/dev/null 2>&1 || {
  echo -e "${RED}❌ Lỗi: Chưa cài đặt hoặc chưa cấu hình AWS CLI. Vui lòng cài đặt 'aws-cli' và cấu hình 'aws configure'.${NC}" >&2
  exit 1
}

command -v zip >/dev/null 2>&1 || {
  echo -e "${YELLOW}⚠️ Cảnh báo: Lệnh 'zip' không tìm thấy. Sẽ fallback sang Python zip script nếu cần.${NC}"
}

cd "$PROJECT_ROOT"

# ------------------------------------------------------------------------------
# BƯỚC 1: Build dự án với OpenNext
# ------------------------------------------------------------------------------
echo -e "\n${YELLOW}[1/5] Đang build Next.js với OpenNext...${NC}"
npm run build:open-next

if [ ! -d ".open-next" ]; then
  echo -e "${RED}❌ Lỗi: Thư mục .open-next không tồn tại sau khi build!${NC}" >&2
  exit 1
fi
echo -e "${GREEN}✔ Build OpenNext thành công!${NC}"

# ------------------------------------------------------------------------------
# BƯỚC 2: Đồng bộ Static Assets lên AWS S3
# ------------------------------------------------------------------------------
echo -e "\n${YELLOW}[2/5] Đang đồng bộ Static Assets lên S3 Bucket: ${S3_BUCKET}...${NC}"

# a. Đồng bộ immutable static chunks (_next/static/*) với Cache-Control dài hạn (1 năm)
if [ -d ".open-next/assets/_next" ]; then
  echo -e "${CYAN}  -> Uploading _next assets (Cache-Control: 1 year, immutable)...${NC}"
  aws s3 sync ".open-next/assets/_next" "s3://${S3_BUCKET}/_next" \
    --region "$REGION" \
    --cache-control "public, max-age=31536000, immutable"
fi

# b. Đồng bộ root assets (HTML, favicon.ico, images, icons, BUILD_ID) với must-revalidate
echo -e "${CYAN}  -> Uploading root public & HTML assets (Cache-Control: no-cache, must-revalidate)...${NC}"
aws s3 sync ".open-next/assets" "s3://${S3_BUCKET}" \
  --region "$REGION" \
  --exclude "_next/*" \
  --cache-control "public, max-age=0, must-revalidate"

echo -e "${GREEN}✔ Đồng bộ S3 Static Assets hoàn tất!${NC}"

# ------------------------------------------------------------------------------
# BƯỚC 3: Đóng gói mã nguồn Lambda (function.zip)
# ------------------------------------------------------------------------------
echo -e "\n${YELLOW}[3/5] Đang đóng gói mã nguồn Serverless Function (.open-next/server-functions/default)...${NC}"

SERVER_DIR="$PROJECT_ROOT/.open-next/server-functions/default"
ZIP_FILE="$PROJECT_ROOT/function.zip"

rm -f "$ZIP_FILE"

if command -v zip >/dev/null 2>&1; then
  (cd "$SERVER_DIR" && zip -qr "$ZIP_FILE" .)
else
  # Fallback dùng python zipfile nếu môi trường thiếu zip cli
  python -c "
import os, zipfile
src = r'$SERVER_DIR'
out = r'$ZIP_FILE'
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    for root, dirs, files in os.walk(src):
        for f in files:
            full = os.path.join(root, f)
            rel = os.path.relpath(full, src)
            z.write(full, rel)
"
fi

ZIP_SIZE_MB=$(du -m "$ZIP_FILE" | cut -f1)
echo -e "${GREEN}✔ Đóng gói function.zip thành công (~${ZIP_SIZE_MB}MB)${NC}"

# ------------------------------------------------------------------------------
# BƯỚC 4: Cập nhật mã nguồn Lambda Function trên AWS
# ------------------------------------------------------------------------------
echo -e "\n${YELLOW}[4/5] Đang đẩy code lên AWS Lambda function: ${LAMBDA_FUNCTION_NAME}...${NC}"

aws lambda update-function-code \
  --function-name "$LAMBDA_FUNCTION_NAME" \
  --zip-file "fileb://$ZIP_FILE" \
  --region "$REGION" \
  --output json >/dev/null

echo -e "${CYAN}  -> Đang đợi Lambda chuyển sang trạng thái Successful...${NC}"
aws lambda wait function-updated \
  --function-name "$LAMBDA_FUNCTION_NAME" \
  --region "$REGION"

echo -e "${GREEN}✔ Cập nhật Lambda Function thành công!${NC}"

# ------------------------------------------------------------------------------
# BƯỚC 5: Tự động Invalidation CloudFront CDN Cache
# ------------------------------------------------------------------------------
echo -e "\n${YELLOW}[5/5] Đang kiểm tra và tạo CloudFront Invalidation (/*)...${NC}"

# Nếu chưa truyền CLOUDFRONT_DISTRIBUTION_ID, tự động truy vấn theo domain
if [ -z "$CLOUDFRONT_DISTRIBUTION_ID" ]; then
  echo -e "${CYAN}  -> Đang tìm Distribution ID cho domain ${CLOUDFRONT_DOMAIN}...${NC}"
  CLOUDFRONT_DISTRIBUTION_ID=$(aws cloudfront list-distributions \
    --query "DistributionList.Items[?DomainName=='${CLOUDFRONT_DOMAIN}'].Id" \
    --output text 2>/dev/null || true)
fi

if [ -n "$CLOUDFRONT_DISTRIBUTION_ID" ] && [ "$CLOUDFRONT_DISTRIBUTION_ID" != "None" ]; then
  echo -e "${CYAN}  -> Tạo Invalidation cho Distribution: ${CLOUDFRONT_DISTRIBUTION_ID}...${NC}"
  INVALIDATION_ID=$(aws cloudfront create-invalidation \
    --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" \
    --paths "/*" \
    --query "Invalidation.Id" \
    --output text)
  echo -e "${GREEN}✔ Đã kích hoạt CloudFront Invalidation ID: ${INVALIDATION_ID}${NC}"
else
  echo -e "${YELLOW}⚠️ Không tìm thấy CloudFront Distribution ID tương ứng với domain ${CLOUDFRONT_DOMAIN}.${NC}"
  echo -e "${YELLOW}  Bạn có thể chạy thủ công: aws cloudfront create-invalidation --distribution-id <ID> --paths '/*'${NC}"
fi

# Dọn dẹp file zip tạm
rm -f "$ZIP_FILE"

echo -e "\n${BLUE}======================================================================${NC}"
echo -e "${GREEN}🎉 DEPLOY HOÀN TẤT THÀNH CÔNG!${NC}"
echo -e "🌐 Website: https://${CLOUDFRONT_DOMAIN}"
echo -e "${BLUE}======================================================================${NC}"
