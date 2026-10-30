################################################################################
# BACKEND MICROSERVICES & EVENT WORKERS LAMBDAS (KHUNG 2 - REPLICA)
################################################################################

locals {
  backend_role_name = "BackendMicroservices-${var.environment}-ExecutionRole"
  env_title         = title(var.environment)
}

# ==============================================================================
# 1. IAM EXECUTION ROLE CHO TOÀN BỘ BACKEND LAMBDAS
# ==============================================================================
resource "aws_iam_role" "backend_exec_role" {
  name = local.backend_role_name

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

  tags = {
    Name        = local.backend_role_name
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

resource "aws_iam_role_policy_attachment" "backend_basic_logs" {
  role       = aws_iam_role.backend_exec_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_policy" "backend_permissions_policy" {
  name        = "BackendPermissionsPolicy-${var.environment}"
  description = "Quyen truy cap DynamoDB, SQS va EventBridge cho Microservices backend"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "DynamoDBAccess"
        Effect   = "Allow"
        Action   = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Scan",
          "dynamodb:Query",
          "dynamodb:BatchGetItem",
          "dynamodb:BatchWriteItem"
        ]
        Resource = [
          aws_dynamodb_table.products.arn,
          "${aws_dynamodb_table.products.arn}/*",
          aws_dynamodb_table.orders.arn,
          "${aws_dynamodb_table.orders.arn}/*",
          aws_dynamodb_table.carts.arn,
          "${aws_dynamodb_table.carts.arn}/*",
          aws_dynamodb_table.users.arn,
          "${aws_dynamodb_table.users.arn}/*"
        ]
      },
      {
        Sid      = "EventBridgePublish"
        Effect   = "Allow"
        Action   = [
          "events:PutEvents"
        ]
        Resource = [
          aws_cloudwatch_event_bus.ecommerce_bus.arn
        ]
      },
      {
        Sid      = "SQSConsume"
        Effect   = "Allow"
        Action   = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = [
          aws_sqs_queue.inventory_queue.arn,
          aws_sqs_queue.shipping_queue.arn,
          aws_sqs_queue.notification_queue.arn
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "backend_custom_attach" {
  role       = aws_iam_role.backend_exec_role.name
  policy_arn = aws_iam_policy.backend_permissions_policy.arn
}

# ==============================================================================
# 2. ARCHIVE SOURCE CODE CHO TỪNG LAMBDA FUNCTION
# ==============================================================================
data "archive_file" "catalog_zip" {
  type        = "zip"
  output_path = "${path.module}/catalog.zip"
  source {
    content  = file("${path.module}/../backend/services/catalog/handler.py")
    filename = "lambda_function.py"
  }
}

data "archive_file" "cart_zip" {
  type        = "zip"
  output_path = "${path.module}/cart.zip"
  source {
    content  = file("${path.module}/../backend/services/cart/handler.py")
    filename = "lambda_function.py"
  }
}

data "archive_file" "order_zip" {
  type        = "zip"
  output_path = "${path.module}/order.zip"
  source {
    content  = file("${path.module}/../backend/services/order/handler.py")
    filename = "lambda_function.py"
  }
}

data "archive_file" "payment_zip" {
  type        = "zip"
  output_path = "${path.module}/payment.zip"
  source {
    content  = file("${path.module}/../backend/services/payment_webhook/handler.py")
    filename = "lambda_function.py"
  }
}

data "archive_file" "user_zip" {
  type        = "zip"
  output_path = "${path.module}/user.zip"
  source {
    content  = file("${path.module}/../backend/services/user/handler.py")
    filename = "lambda_function.py"
  }
}

data "archive_file" "inventory_zip" {
  type        = "zip"
  output_path = "${path.module}/inventory.zip"
  source {
    content  = file("${path.module}/../backend/workers/inventory/handler.py")
    filename = "lambda_function.py"
  }
}

data "archive_file" "shipping_zip" {
  type        = "zip"
  output_path = "${path.module}/shipping.zip"
  source {
    content  = file("${path.module}/../backend/workers/shipping/handler.py")
    filename = "lambda_function.py"
  }
}

data "archive_file" "notification_zip" {
  type        = "zip"
  output_path = "${path.module}/notification.zip"
  source {
    content  = file("${path.module}/../backend/workers/notification/handler.py")
    filename = "lambda_function.py"
  }
}

# ==============================================================================
# 3. NHÓM 5 REST API MICROSERVICES
# ==============================================================================

# 1. Catalog Service
resource "aws_lambda_function" "catalog_service" {
  function_name    = "CatalogServiceHandler-${local.env_title}"
  role             = aws_iam_role.backend_exec_role.arn
  runtime          = "python3.12"
  handler          = "lambda_function.lambda_handler"
  memory_size      = 256
  timeout          = 15
  filename         = data.archive_file.catalog_zip.output_path
  source_code_hash = data.archive_file.catalog_zip.output_base64sha256

  lifecycle {
    ignore_changes = [filename, source_code_hash]
  }

  environment {
    variables = {
      PRODUCTS_TABLE = aws_dynamodb_table.products.name
    }
  }

  tags = {
    Name        = "CatalogServiceHandler-${local.env_title}"
    Environment = var.environment
  }
}

# 2. Cart Service
resource "aws_lambda_function" "cart_service" {
  function_name    = "CartServiceHandler-${local.env_title}"
  role             = aws_iam_role.backend_exec_role.arn
  runtime          = "python3.12"
  handler          = "lambda_function.lambda_handler"
  memory_size      = 256
  timeout          = 15
  filename         = data.archive_file.cart_zip.output_path
  source_code_hash = data.archive_file.cart_zip.output_base64sha256

  lifecycle {
    ignore_changes = [filename, source_code_hash]
  }

  environment {
    variables = {
      CARTS_TABLE    = aws_dynamodb_table.carts.name
      PRODUCTS_TABLE = aws_dynamodb_table.products.name
    }
  }

  tags = {
    Name        = "CartServiceHandler-${local.env_title}"
    Environment = var.environment
  }
}

# 3. Order Service
resource "aws_lambda_function" "order_service" {
  function_name    = "OrderServiceHandler-${local.env_title}"
  role             = aws_iam_role.backend_exec_role.arn
  runtime          = "python3.12"
  handler          = "lambda_function.lambda_handler"
  memory_size      = 512
  timeout          = 20
  filename         = data.archive_file.order_zip.output_path
  source_code_hash = data.archive_file.order_zip.output_base64sha256

  lifecycle {
    ignore_changes = [filename, source_code_hash]
  }

  environment {
    variables = {
      ORDERS_TABLE      = aws_dynamodb_table.orders.name
      CARTS_TABLE       = aws_dynamodb_table.carts.name
      PRODUCTS_TABLE    = aws_dynamodb_table.products.name
      EVENT_BUS_NAME    = aws_cloudwatch_event_bus.ecommerce_bus.name
      VNPAY_RETURN_URL  = "https://${aws_cloudfront_distribution.main.domain_name}/order-success"
      VNPAY_HASH_SECRET = "RAHQKBUFUIZLMTMDIPOSYMPS"
      VNPAY_TMN_CODE    = "2QXUI4J4"
      VNPAY_URL         = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html"
    }
  }

  tags = {
    Name        = "OrderServiceHandler-${local.env_title}"
    Environment = var.environment
  }
}

# 4. Payment Webhook Service
resource "aws_lambda_function" "payment_webhook" {
  function_name    = "PaymentWebhookHandler-${local.env_title}"
  role             = aws_iam_role.backend_exec_role.arn
  runtime          = "python3.12"
  handler          = "lambda_function.lambda_handler"
  memory_size      = 256
  timeout          = 15
  filename         = data.archive_file.payment_zip.output_path
  source_code_hash = data.archive_file.payment_zip.output_base64sha256

  lifecycle {
    ignore_changes = [filename, source_code_hash]
  }

  environment {
    variables = {
      ORDERS_TABLE      = aws_dynamodb_table.orders.name
      EVENT_BUS_NAME    = aws_cloudwatch_event_bus.ecommerce_bus.name
      VNPAY_HASH_SECRET = "RAHQKBUFUIZLMTMDIPOSYMPS"
    }
  }

  tags = {
    Name        = "PaymentWebhookHandler-${local.env_title}"
    Environment = var.environment
  }
}

# 5. User Profile Service
resource "aws_lambda_function" "user_service" {
  function_name    = "UserProfileHandler-${local.env_title}"
  role             = aws_iam_role.backend_exec_role.arn
  runtime          = "python3.12"
  handler          = "lambda_function.lambda_handler"
  memory_size      = 256
  timeout          = 15
  filename         = data.archive_file.user_zip.output_path
  source_code_hash = data.archive_file.user_zip.output_base64sha256

  lifecycle {
    ignore_changes = [filename, source_code_hash]
  }

  environment {
    variables = {
      USERS_TABLE = aws_dynamodb_table.users.name
    }
  }

  tags = {
    Name        = "UserProfileHandler-${local.env_title}"
    Environment = var.environment
  }
}

# ==============================================================================
# 4. NHÓM 3 EVENT WORKERS (XỬ LÝ BẤT ĐỒNG BỘ TỪ SQS)
# ==============================================================================

# 6. Inventory Worker
resource "aws_lambda_function" "inventory_worker" {
  function_name    = "InventoryWorker-${local.env_title}"
  role             = aws_iam_role.backend_exec_role.arn
  runtime          = "python3.12"
  handler          = "lambda_function.lambda_handler"
  memory_size      = 256
  timeout          = 30
  filename         = data.archive_file.inventory_zip.output_path
  source_code_hash = data.archive_file.inventory_zip.output_base64sha256

  lifecycle {
    ignore_changes = [filename, source_code_hash]
  }

  environment {
    variables = {
      PRODUCTS_TABLE = aws_dynamodb_table.products.name
    }
  }

  tags = {
    Name        = "InventoryWorker-${local.env_title}"
    Environment = var.environment
  }
}

resource "aws_lambda_event_source_mapping" "inventory_sqs_trigger" {
  event_source_arn = aws_sqs_queue.inventory_queue.arn
  function_name    = aws_lambda_function.inventory_worker.arn
  batch_size       = 5
  enabled          = true
}

# 7. Shipping Worker (GHN API)
resource "aws_lambda_function" "shipping_worker" {
  function_name    = "ShippingWorker-${local.env_title}"
  role             = aws_iam_role.backend_exec_role.arn
  runtime          = "python3.12"
  handler          = "lambda_function.lambda_handler"
  memory_size      = 256
  timeout          = 30
  filename         = data.archive_file.shipping_zip.output_path
  source_code_hash = data.archive_file.shipping_zip.output_base64sha256

  lifecycle {
    ignore_changes = [filename, source_code_hash]
  }

  environment {
    variables = {
      ORDERS_TABLE     = aws_dynamodb_table.orders.name
      EVENT_BUS_NAME   = aws_cloudwatch_event_bus.ecommerce_bus.name
      GHN_API_URL      = "https://dev-online-gateway.ghn.vn/shiip/public-api/v2/shipping-order/create"
      GHN_API_TOKEN    = "b0ea8297-6801-4aa1-a811-5e21a5f7aa2d"
      GHN_SHOP_ID      = "233963"
      SHIPPING_PARTNER = "Giao Hàng Nhanh (GHN)"
    }
  }

  tags = {
    Name        = "ShippingWorker-${local.env_title}"
    Environment = var.environment
  }
}

resource "aws_lambda_event_source_mapping" "shipping_sqs_trigger" {
  event_source_arn = aws_sqs_queue.shipping_queue.arn
  function_name    = aws_lambda_function.shipping_worker.arn
  batch_size       = 5
  enabled          = true
}

# 8. Notification Worker (Gmail SMTP)
resource "aws_lambda_function" "notification_worker" {
  function_name    = "NotificationWorker-${local.env_title}"
  role             = aws_iam_role.backend_exec_role.arn
  runtime          = "python3.12"
  handler          = "lambda_function.lambda_handler"
  memory_size      = 256
  timeout          = 30
  filename         = data.archive_file.notification_zip.output_path
  source_code_hash = data.archive_file.notification_zip.output_base64sha256

  lifecycle {
    ignore_changes = [filename, source_code_hash]
  }

  environment {
    variables = {
      SMTP_SERVER   = "smtp.gmail.com"
      SMTP_PORT     = "465"
      SMTP_USER     = "phutungxemay246@gmail.com"
      SMTP_PASSWORD = "vzjlptdpcbkdmjyv"
    }
  }

  tags = {
    Name        = "NotificationWorker-${local.env_title}"
    Environment = var.environment
  }
}

resource "aws_lambda_event_source_mapping" "notification_sqs_trigger" {
  event_source_arn = aws_sqs_queue.notification_queue.arn
  function_name    = aws_lambda_function.notification_worker.arn
  batch_size       = 5
  enabled          = true
}
