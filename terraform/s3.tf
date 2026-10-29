################################################################################
# S3 BUCKET: FRONTEND STATIC HOSTING & ASSETS
################################################################################

# 1. Bucket chứa Next.js static assets (_next/static/...)
resource "aws_s3_bucket" "frontend_hosting" {
  bucket = var.hosting_bucket_name

  tags = {
    Name        = "${var.project_name}-frontend-hosting-${var.environment}"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# 2. Chặn toàn bộ Public Access trực tiếp vào S3 (bắt buộc đi qua CloudFront OAC)
resource "aws_s3_bucket_public_access_block" "frontend_hosting" {
  bucket = aws_s3_bucket.frontend_hosting.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# 3. CloudFront Origin Access Control (OAC) cho S3 Frontend
resource "aws_cloudfront_origin_access_control" "hosting_oac" {
  name                              = "${var.hosting_bucket_name}-oac"
  description                       = "OAC cho S3 Frontend Hosting"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# 4. S3 Bucket Policy: Chỉ cho phép CloudFront Distribution đọc assets
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
