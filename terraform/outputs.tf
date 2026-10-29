################################################################################
# FRONTEND INFRASTRUCTURE OUTPUTS
################################################################################

output "cloudfront_domain_name" {
  description = "Tên miền CloudFront phân phối Frontend Next.js"
  value       = aws_cloudfront_distribution.main.domain_name
}

output "cloudfront_distribution_id" {
  description = "ID của CloudFront Distribution (dùng cho Cache Invalidation)"
  value       = aws_cloudfront_distribution.main.id
}

output "s3_hosting_bucket_name" {
  description = "Tên S3 Bucket hosting static assets (_next/static)"
  value       = aws_s3_bucket.frontend_hosting.id
}

output "lambda_nextjs_function_name" {
  description = "Tên của Lambda Next.js SSR"
  value       = aws_lambda_function.nextjs_server.function_name
}

output "lambda_nextjs_function_url" {
  description = "Function URL của Next.js SSR Lambda Streaming"
  value       = aws_lambda_function_url.nextjs_url.function_url
}
