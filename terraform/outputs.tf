################################################################################
# FRONTEND & BACKEND INFRASTRUCTURE OUTPUTS (REPLICA)
################################################################################

output "cloudfront_domain_name" {
  description = "Tên miền CloudFront phân phối Frontend Next.js & REST API"
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

output "s3_product_images_bucket_name" {
  description = "Tên S3 Bucket lưu trữ hình ảnh sản phẩm (/images/*)"
  value       = aws_s3_bucket.product_images.id
}

output "lambda_nextjs_function_name" {
  description = "Tên của Lambda Next.js SSR"
  value       = aws_lambda_function.nextjs_server.function_name
}

output "lambda_nextjs_function_url" {
  description = "Function URL của Next.js SSR Lambda Streaming"
  value       = aws_lambda_function_url.nextjs_url.function_url
}

output "api_gateway_rest_endpoint" {
  description = "Invoke URL của REST API Gateway"
  value       = aws_api_gateway_stage.prod.invoke_url
}

output "cognito_user_pool_id" {
  description = "ID của Amazon Cognito User Pool"
  value       = aws_cognito_user_pool.pool.id
}

output "cognito_client_id" {
  description = "ID của Amazon Cognito App Client (Public SPA)"
  value       = aws_cognito_user_pool_client.client.id
}

output "event_bus_name" {
  description = "Tên của Amazon EventBridge Event Bus"
  value       = aws_cloudwatch_event_bus.ecommerce_bus.name
}
