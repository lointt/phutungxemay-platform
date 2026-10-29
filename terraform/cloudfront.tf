################################################################################
# CLOUDFRONT CDN DISTRIBUTION (FRONTEND ROUTING & EDGE ACCELERATION)
################################################################################

locals {
  managed_caching_disabled_id       = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"
  managed_caching_optimized_id      = "658327ea-f89d-4fab-a63d-7e88639e58f6"
  managed_all_viewer_except_host_id = "b689b0a8-53d0-40ab-baf2-68738e2966ac"
  lambda_url_domain                 = replace(replace(aws_lambda_function_url.nextjs_url.function_url, "https://", ""), "/", "")
}

resource "aws_cloudfront_distribution" "main" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "CloudFront Distribution cho Frontend Next.js (${var.environment})"
  default_root_object = ""

  # Origin 1: Lambda Next.js Server Function URL (SSR Streaming)
  origin {
    domain_name = local.lambda_url_domain
    origin_id   = "NextjsLambdaServerOrigin"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  # Origin 2: S3 Frontend Hosting (_next/static/...)
  origin {
    domain_name              = aws_s3_bucket.frontend_hosting.bucket_regional_domain_name
    origin_id                = "FrontendHostingOrigin"
    origin_access_control_id = aws_cloudfront_origin_access_control.hosting_oac.id
  }

  # Default Cache Behavior: Chuyển tiếp toàn bộ request động vào Lambda SSR Function URL
  default_cache_behavior {
    target_origin_id       = "NextjsLambdaServerOrigin"
    viewer_protocol_policy = "redirect-to-https"

    allowed_methods = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods  = ["GET", "HEAD"]

    compress                 = true
    cache_policy_id          = local.managed_caching_disabled_id
    origin_request_policy_id = local.managed_all_viewer_except_host_id
  }

  # Ordered Behavior 1: Phục vụ Static Assets từ S3 (_next/*) với Cache tối ưu
  ordered_cache_behavior {
    path_pattern     = "/_next/*"
    target_origin_id = "FrontendHostingOrigin"

    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]

    compress        = true
    cache_policy_id = local.managed_caching_optimized_id
  }

  price_class = "PriceClass_100"

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = {
    Name        = "${var.project_name}-frontend-cdn-${var.environment}"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}
