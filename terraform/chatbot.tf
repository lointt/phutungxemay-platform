################################################################################
# CHATBOT INFRASTRUCTURE (KHUNG 3 & KHUNG 4: RAG WEBSOCKET & DATA SYNC)
################################################################################

# ==============================================================================
# 1. S3 BUCKET LƯU TRỮ VECTOR KNOWLEDGE BASE (JSON SNAPSHOTS)
# ==============================================================================
resource "aws_s3_bucket" "chatbot_kb" {
  bucket = "chatbot-kb-741796256397-dev"

  tags = {
    Name        = "Chatbot-KB-${var.environment}"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

resource "aws_s3_bucket_versioning" "chatbot_kb" {
  bucket = aws_s3_bucket.chatbot_kb.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "chatbot_kb" {
  bucket = aws_s3_bucket.chatbot_kb.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# ==============================================================================
# 2. API GATEWAY V2 WEBSOCKET API (2-WAY REALTIME COMMUNICATION)
# ==============================================================================
resource "aws_apigatewayv2_api" "chatbot_ws" {
  name                       = "chatbot-ws"
  protocol_type              = "WEBSOCKET"
  route_selection_expression = "$request.body.action"

  tags = {
    Name        = "Chatbot-WebSocket-API-${var.environment}"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

resource "aws_apigatewayv2_integration" "chat_receiver_integration" {
  api_id           = aws_apigatewayv2_api.chatbot_ws.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.chat_receiver.invoke_arn
}

resource "aws_apigatewayv2_route" "connect_route" {
  api_id    = aws_apigatewayv2_api.chatbot_ws.id
  route_key = "$connect"
  target    = "integrations/${aws_apigatewayv2_integration.chat_receiver_integration.id}"
}

resource "aws_apigatewayv2_route" "disconnect_route" {
  api_id    = aws_apigatewayv2_api.chatbot_ws.id
  route_key = "$disconnect"
  target    = "integrations/${aws_apigatewayv2_integration.chat_receiver_integration.id}"
}

resource "aws_apigatewayv2_route" "send_message_route" {
  api_id    = aws_apigatewayv2_api.chatbot_ws.id
  route_key = "sendMessage"
  target    = "integrations/${aws_apigatewayv2_integration.chat_receiver_integration.id}"
}

resource "aws_apigatewayv2_deployment" "chatbot_deployment" {
  api_id = aws_apigatewayv2_api.chatbot_ws.id

  depends_on = [
    aws_apigatewayv2_route.connect_route,
    aws_apigatewayv2_route.disconnect_route,
    aws_apigatewayv2_route.send_message_route
  ]

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_apigatewayv2_stage" "chatbot_dev_stage" {
  api_id        = aws_apigatewayv2_api.chatbot_ws.id
  name          = "dev"
  deployment_id = aws_apigatewayv2_deployment.chatbot_deployment.id
  auto_deploy   = true

  default_route_settings {
    throttling_burst_limit = 20
    throttling_rate_limit  = 10
  }
}

resource "aws_lambda_permission" "api_invoke_receiver" {
  statement_id  = "AllowExecutionFromApiGatewayWebSocket"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.chat_receiver.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.chatbot_ws.execution_arn}/*/*"
}

# ==============================================================================
# 3. IAM ROLES CHO CÁC HÀM LAMBDA CHATBOT & DATA SYNC
# ==============================================================================

# Role cho Chat Receiver (Nhẹ, chỉ cần log + invoke orchestrator)
resource "aws_iam_role" "chatbot_receiver_role" {
  name = "ChatbotReceiver-ExecutionRole-${local.env_title}"

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

resource "aws_iam_role_policy" "chatbot_receiver_policy" {
  name = "ChatbotReceiverPolicy"
  role = aws_iam_role.chatbot_receiver_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "CloudWatchLogs"
        Effect   = "Allow"
        Action   = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Sid      = "InvokeOrchestrator"
        Effect   = "Allow"
        Action   = [
          "lambda:InvokeFunction"
        ]
        Resource = [
          aws_lambda_function.chat_orchestrator.arn
        ]
      }
    ]
  })
}

# Role cho Chat Orchestrator (Xử lý RAG, DynamoDB, S3, SSM, Push WebSocket)
resource "aws_iam_role" "chatbot_orchestrator_role" {
  name = "ChatbotOrchestrator-ExecutionRole-${local.env_title}"

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

resource "aws_iam_role_policy" "chatbot_orchestrator_policy" {
  name = "ChatbotOrchestratorPolicy"
  role = aws_iam_role.chatbot_orchestrator_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "CloudWatchLogs"
        Effect   = "Allow"
        Action   = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Sid      = "DynamoDBReadWriteAccess"
        Effect   = "Allow"
        Action   = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = [
          aws_dynamodb_table.chatbot_sessions.arn,
          "${aws_dynamodb_table.chatbot_sessions.arn}/*",
          aws_dynamodb_table.products.arn,
          "${aws_dynamodb_table.products.arn}/*",
          aws_dynamodb_table.carts.arn,
          "${aws_dynamodb_table.carts.arn}/*",
          aws_dynamodb_table.users.arn,
          "${aws_dynamodb_table.users.arn}/*",
          aws_dynamodb_table.store_policies.arn,
          "${aws_dynamodb_table.store_policies.arn}/*"
        ]
      },
      {
        Sid      = "S3VectorKBAccess"
        Effect   = "Allow"
        Action   = [
          "s3:GetObject"
        ]
        Resource = [
          "${aws_s3_bucket.chatbot_kb.arn}/*"
        ]
      },
      {
        Sid      = "SSMGeminiKeyAccess"
        Effect   = "Allow"
        Action   = [
          "ssm:GetParameter",
          "ssm:GetParameters"
        ]
        Resource = [
          "arn:aws:ssm:${var.aws_region}:*:parameter/chatbot/*"
        ]
      },
      {
        Sid      = "ApiGatewayManageConnections"
        Effect   = "Allow"
        Action   = [
          "execute-api:ManageConnections"
        ]
        Resource = [
          "${aws_apigatewayv2_api.chatbot_ws.execution_arn}/*/*"
        ]
      },
      {
        Sid      = "EventBridgePublishHandover"
        Effect   = "Allow"
        Action   = [
          "events:PutEvents"
        ]
        Resource = [
          aws_cloudwatch_event_bus.ecommerce_bus.arn
        ]
      }
    ]
  })
}

# Role cho Khung 4: Data Sync (DynamoDB Streams CDC -> S3 Vector KB)
resource "aws_iam_role" "sync_to_kb_role" {
  name = "DataSyncToKB-ExecutionRole-${local.env_title}"

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

resource "aws_iam_role_policy" "sync_to_kb_policy" {
  name = "DataSyncToKBPolicy"
  role = aws_iam_role.sync_to_kb_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "CloudWatchLogs"
        Effect   = "Allow"
        Action   = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Sid      = "DynamoDBStreamsAccess"
        Effect   = "Allow"
        Action   = [
          "dynamodb:GetRecords",
          "dynamodb:GetShardIterator",
          "dynamodb:DescribeStream",
          "dynamodb:ListStreams"
        ]
        Resource = [
          aws_dynamodb_table.products.stream_arn,
          aws_dynamodb_table.store_policies.stream_arn
        ]
      },
      {
        Sid      = "DynamoDBReadAccess"
        Effect   = "Allow"
        Action   = [
          "dynamodb:Scan",
          "dynamodb:Query",
          "dynamodb:GetItem"
        ]
        Resource = [
          aws_dynamodb_table.products.arn,
          aws_dynamodb_table.store_policies.arn
        ]
      },
      {
        Sid      = "S3VectorKBWriteAccess"
        Effect   = "Allow"
        Action   = [
          "s3:PutObject",
          "s3:GetObject"
        ]
        Resource = [
          "${aws_s3_bucket.chatbot_kb.arn}/*"
        ]
      },
      {
        Sid      = "SSMGeminiKeyAccess"
        Effect   = "Allow"
        Action   = [
          "ssm:GetParameter",
          "ssm:GetParameters"
        ]
        Resource = [
          "arn:aws:ssm:${var.aws_region}:*:parameter/chatbot/*"
        ]
      }
    ]
  })
}

# ==============================================================================
# 4. PACKAGING SOURCE CODE CHO CÁC HÀM LAMBDA
# ==============================================================================
data "archive_file" "chat_receiver_zip" {
  type        = "zip"
  output_path = "${path.module}/chat_receiver.zip"
  source {
    content  = file("${path.module}/../backend/services/chatbot_receiver/handler.py")
    filename = "lambda_function.py"
  }
}

data "archive_file" "chat_orchestrator_zip" {
  type        = "zip"
  output_path = "${path.module}/chat_orchestrator.zip"
  source {
    content  = file("${path.module}/../backend/services/chatbot_orchestrator/handler.py")
    filename = "lambda_function.py"
  }
}

data "archive_file" "sync_to_kb_zip" {
  type        = "zip"
  output_path = "${path.module}/sync_to_kb.zip"
  source {
    content  = file("${path.module}/../backend/services/sync_to_kb/handler.py")
    filename = "lambda_function.py"
  }
}

# ==============================================================================
# 5. KHAI BÁO CÁC HÀM LAMBDA (RUNTIME PYTHON 3.12, ZIP PACKAGING - BỎ DOCKER)
# ==============================================================================

# Lambda 1: Chat Receiver (Dispatcher)
resource "aws_lambda_function" "chat_receiver" {
  function_name    = "chat-receiver"
  role             = aws_iam_role.chatbot_receiver_role.arn
  runtime          = "python3.12"
  handler          = "lambda_function.lambda_handler"
  memory_size      = 128
  timeout          = 10
  filename         = data.archive_file.chat_receiver_zip.output_path
  source_code_hash = data.archive_file.chat_receiver_zip.output_base64sha256

  lifecycle {
    ignore_changes = [filename, source_code_hash]
  }

  environment {
    variables = {
      WORKER_FUNCTION = "chat-orchestrator-v2"
    }
  }

  tags = {
    Name        = "ChatReceiver-${local.env_title}"
    Environment = var.environment
  }
}

# Lambda 2: Chat Orchestrator (Worker RAG v2)
resource "aws_lambda_function" "chat_orchestrator" {
  function_name    = "chat-orchestrator-v2"
  role             = aws_iam_role.chatbot_orchestrator_role.arn
  runtime          = "python3.12"
  handler          = "lambda_function.lambda_handler"
  memory_size      = 1024
  timeout          = 60
  filename         = data.archive_file.chat_orchestrator_zip.output_path
  source_code_hash = data.archive_file.chat_orchestrator_zip.output_base64sha256

  lifecycle {
    ignore_changes = [filename, source_code_hash, image_uri]
  }

  environment {
    variables = {
      AWS_REGION_NAME      = var.aws_region
      GEMINI_SSM_PARAM     = aws_ssm_parameter.gemini_api_key.name
      SESSION_TABLE        = aws_dynamodb_table.chatbot_sessions.name
      USERS_TABLE          = aws_dynamodb_table.users.name
      CARTS_TABLE          = aws_dynamodb_table.carts.name
      PRODUCTS_TABLE       = aws_dynamodb_table.products.name
      STORE_POLICIES_TABLE = aws_dynamodb_table.store_policies.name
      VECTOR_BUCKET        = aws_s3_bucket.chatbot_kb.bucket
      EVENT_BUS            = aws_cloudwatch_event_bus.ecommerce_bus.name
    }
  }

  tags = {
    Name        = "ChatOrchestrator-${local.env_title}"
    Environment = var.environment
  }
}

# Lambda 3: Khung 4 - Data Sync (DynamoDB Streams CDC -> S3 Vector KB)
resource "aws_lambda_function" "sync_to_kb" {
  function_name    = "DynamoDBSyncToKBHandler-${local.env_title}"
  role             = aws_iam_role.sync_to_kb_role.arn
  runtime          = "python3.12"
  handler          = "lambda_function.lambda_handler"
  memory_size      = 512
  timeout          = 60
  filename         = data.archive_file.sync_to_kb_zip.output_path
  source_code_hash = data.archive_file.sync_to_kb_zip.output_base64sha256

  lifecycle {
    ignore_changes = [filename, source_code_hash]
  }

  environment {
    variables = {
      AWS_REGION_NAME  = var.aws_region
      GEMINI_SSM_PARAM = aws_ssm_parameter.gemini_api_key.name
      PRODUCTS_TABLE   = aws_dynamodb_table.products.name
      POLICIES_TABLE   = aws_dynamodb_table.store_policies.name
      VECTOR_BUCKET    = aws_s3_bucket.chatbot_kb.bucket
    }
  }

  tags = {
    Name        = "DataSyncToKB-${local.env_title}"
    Environment = var.environment
  }
}

# Event Source Mappings cho Khung 4 (Lắng nghe CDC từ 2 bảng)
resource "aws_lambda_event_source_mapping" "products_stream_to_kb" {
  event_source_arn  = aws_dynamodb_table.products.stream_arn
  function_name     = aws_lambda_function.sync_to_kb.arn
  starting_position = "LATEST"
  batch_size        = 10
}

resource "aws_lambda_event_source_mapping" "policies_stream_to_kb" {
  event_source_arn  = aws_dynamodb_table.store_policies.stream_arn
  function_name     = aws_lambda_function.sync_to_kb.arn
  starting_position = "LATEST"
  batch_size        = 5
}
