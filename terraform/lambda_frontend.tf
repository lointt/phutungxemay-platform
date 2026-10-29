################################################################################
# NEXT.JS SSR LAMBDA (OPENNEXT SERVER RUNTIME)
################################################################################

locals {
  lambda_name = var.environment == "prod" ? "NextjsServerHandler" : "NextjsServerHandler-${title(var.environment)}"
  role_name   = "NextjsServerHandler-${var.environment}-ExecutionRole"
}

# 1. IAM Role cho NextjsServerHandler
resource "aws_iam_role" "lambda_nextjs_exec" {
  name = local.role_name

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

# 2. Gắn policy ghi log CloudWatch
resource "aws_iam_role_policy_attachment" "lambda_nextjs_basic" {
  role       = aws_iam_role.lambda_nextjs_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# 3. Dummy package khi khởi tạo hạ tầng lần đầu
data "archive_file" "dummy_lambda_zip" {
  type        = "zip"
  output_path = "${path.module}/dummy_lambda.zip"

  source {
    content  = "exports.handler = async () => ({ statusCode: 200, headers: {'content-type':'text/html'}, body: '<h1>OpenNext Next.js SSR Initialized</h1>' });"
    filename = "index.js"
  }
}

# 4. Lambda Function NextjsServerHandler (Node.js 22)
resource "aws_lambda_function" "nextjs_server" {
  function_name = local.lambda_name
  role          = aws_iam_role.lambda_nextjs_exec.arn
  runtime       = "nodejs22.x"
  handler       = "index.handler"
  memory_size   = 1024
  timeout       = 30

  filename         = data.archive_file.dummy_lambda_zip.output_path
  source_code_hash = data.archive_file.dummy_lambda_zip.output_base64sha256

  lifecycle {
    ignore_changes = [
      filename,
      source_code_hash,
      handler
    ]
  }

  environment {
    variables = {
      NODE_ENV = "production"
    }
  }

  tags = {
    Name        = local.lambda_name
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# 5. Lambda Function URL hỗ trợ Streaming SSR
resource "aws_lambda_function_url" "nextjs_url" {
  function_name      = aws_lambda_function.nextjs_server.function_name
  authorization_type = "NONE"
  invoke_mode        = "RESPONSE_STREAM"
}

# 6. Cấp quyền truy cập công khai cho Function URL (gọi URL)
resource "aws_lambda_permission" "allow_public_function_url" {
  statement_id           = "FunctionURLAllowPublicAccess"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.nextjs_server.function_name
  principal              = "*"
  function_url_auth_type = "NONE"
}

# 7. Cấp quyền thực thi mã nguồn Lambda khi được gọi qua Function URL (Tránh lỗi 403 Forbidden)
resource "aws_lambda_permission" "allow_invoke_via_function_url" {
  statement_id           = "FunctionURLAllowInvokeAction"
  action                 = "lambda:InvokeFunction"
  function_name          = aws_lambda_function.nextjs_server.function_name
  principal              = "*"
  function_url_auth_type = "NONE"
}
