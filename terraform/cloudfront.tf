################################################################################
# CLOUDFRONT CDN DISTRIBUTION (FRONTEND & BACKEND ROUTING - REPLICA)
################################################################################

locals {
  managed_caching_disabled_id       = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"
  managed_caching_optimized_id      = "658327ea-f89d-4fab-a63d-7e88639e58f6"
  managed_all_viewer_except_host_id = "b689b0a8-53d0-40ab-baf2-68738e2966ac"
  lambda_url_domain                 = replace(replace(aws_lambda_function_url.nextjs_url.function_url, "https://", ""), "/", "")
  cf_func_name                      = "strip-api-prefix-${var.environment}"
}

# 1. CloudFront Function: Cắt bỏ tiền tố /api trước khi chuyển tới API Gateway
resource "aws_cloudfront_function" "strip_api_prefix" {
  name    = local.cf_func_name
  runtime = "cloudfront-js-2.0"
  comment = "Cat bo tien to /api truoc khi chuyen tiep toi API Gateway REST"
  publish = true
  code    = <<-EOF
    function handler(event) {
        var request = event.request;
        request.uri = request.uri.replace(/^\/api/, '');
        if (request.uri === '') {
            request.uri = '/';
        }
        return request;
    }
  EOF
}

# 2. CloudFront Distribution chính
resource "aws_cloudfront_distribution" "main" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "CloudFront Distribution cho Frontend & Backend (${var.environment})"
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

  # Origin 3: API Gateway REST (/api/...)
  origin {
    domain_name = "${aws_api_gateway_rest_api.rest_api.id}.execute-api.${var.aws_region}.amazonaws.com"
    origin_id   = "APIGateway-RestAPI-Origin"
    origin_path = "/prod"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
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

  # Ordered Behavior 2: Chuyển tiếp toàn bộ API calls (/api/*) sang API Gateway REST
  ordered_cache_behavior {
    path_pattern     = "/api/*"
    target_origin_id = "APIGateway-RestAPI-Origin"

    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods         = ["GET", "HEAD"]

    compress                 = true
    cache_policy_id          = local.managed_caching_disabled_id
    origin_request_policy_id = local.managed_all_viewer_except_host_id

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.strip_api_prefix.arn
    }
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
    Name        = "${var.project_name}-cdn-${var.environment}"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}
