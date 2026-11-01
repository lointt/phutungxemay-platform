################################################################################
# S3 BUCKETS: FRONTEND STATIC HOSTING & PRODUCT IMAGES
################################################################################

# ==============================================================================
# 1. BUCKET 1: FRONTEND STATIC HOSTING & ASSETS (_next/static/...)
# ==============================================================================
resource "aws_s3_bucket" "frontend_hosting" {
  bucket = var.hosting_bucket_name

  tags = {
    Name        = "${var.project_name}-frontend-hosting-${var.environment}"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# Chặn toàn bộ Public Access trực tiếp vào S3 Frontend
resource "aws_s3_bucket_public_access_block" "frontend_hosting" {
  bucket = aws_s3_bucket.frontend_hosting.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# CloudFront Origin Access Control (OAC) dùng chung cho cả 2 S3 Buckets
resource "aws_cloudfront_origin_access_control" "hosting_oac" {
  name                              = "${var.hosting_bucket_name}-oac"
  description                       = "OAC cho S3 Frontend Hosting va Product Images"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# S3 Bucket Policy cho Frontend Hosting
resource "aws_s3_bucket_policy" "frontend_hosting" {
  bucket = aws_s3_bucket.frontend_hosting.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowCloudFrontServicePrincipalReadOnly"
        Effect    = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.frontend_hosting.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.main.arn
          }
        }
      }
    ]
  })
}

# ==============================================================================
# 2. BUCKET 2: PRODUCT IMAGES (/images/*)
# ==============================================================================
resource "aws_s3_bucket" "product_images" {
  bucket = var.product_images_bucket_name

  tags = {
    Name        = "${var.project_name}-product-images-${var.environment}"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# Bật Versioning để bảo vệ dữ liệu hình ảnh sản phẩm, chống xóa nhầm/ghi đè
resource "aws_s3_bucket_versioning" "product_images" {
  bucket = aws_s3_bucket.product_images.id
  versioning_configuration {
    status = "Enabled"
  }
}

# Chặn toàn bộ Public Access trực tiếp vào S3 Product Images
resource "aws_s3_bucket_public_access_block" "product_images" {
  bucket = aws_s3_bucket.product_images.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Cấu hình CORS cho phép Browser upload trực tiếp ảnh qua S3 Pre-signed URL
resource "aws_s3_bucket_cors_configuration" "product_images" {
  bucket = aws_s3_bucket.product_images.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["PUT", "POST", "GET", "HEAD"]
    allowed_origins = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

# S3 Bucket Policy: Cho phép CloudFront Distribution OAC đọc ảnh sản phẩm
resource "aws_s3_bucket_policy" "product_images" {
  bucket = aws_s3_bucket.product_images.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowCloudFrontServicePrincipalReadOnlyImages"
        Effect    = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.product_images.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.main.arn
          }
        }
      }
    ]
  })
}
