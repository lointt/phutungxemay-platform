################################################################################
# BACKEND MICROSERVICES & EVENT WORKERS LAMBDAS (KHUNG 2 - REPLICA)
################################################################################

locals {
  env_title = title(var.environment)

  lambda_assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action    = "sts:AssumeRole"
        Effect    = "Allow"
        Principal = { Service = "lambda.amazonaws.com" }
      }
    ]
  })
}

# ==============================================================================
# 1. IAM EXECUTION ROLES CHO TỪNG MICROSERVICE & WORKER (LEAST PRIVILEGE)
# ==============================================================================

# ------------------------------------------------------------------------------
# 1.1 Catalog Service Role & Policy (CRUD Sản phẩm & Presigned Upload S3)
# ------------------------------------------------------------------------------
resource "aws_iam_role" "catalog_service_role" {
  name               = "CatalogServiceRole-${var.environment}"
  assume_role_policy = local.lambda_assume_role_policy

  tags = {
    Name        = "CatalogServiceRole-${var.environment}"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

resource "aws_iam_role_policy_attachment" "catalog_basic_logs" {
  role       = aws_iam_role.catalog_service_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "catalog_service_policy" {
  name = "CatalogServicePolicy-${var.environment}"
  role = aws_iam_role.catalog_service_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ProductCatalogCRUD"
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem"
        ]
        Resource = [
          aws_dynamodb_table.products.arn,
          "${aws_dynamodb_table.products.arn}/*"
        ]
      },
      {
        Sid    = "UploadProductImagesPresignedUrl"
        Effect = "Allow"
        Action = [
          "s3:PutObject"
        ]
        Resource = [
          "${aws_s3_bucket.product_images.arn}/*"
        ]
      }
    ]
  })
}

# ------------------------------------------------------------------------------
# 1.2 Cart Service Role & Policy (Thao tác Giỏ hàng & Kiểm tra Tồn kho)
# ------------------------------------------------------------------------------
resource "aws_iam_role" "cart_service_role" {
  name               = "CartServiceRole-${var.environment}"
  assume_role_policy = local.lambda_assume_role_policy

  tags = {
    Name        = "CartServiceRole-${var.environment}"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

resource "aws_iam_role_policy_attachment" "cart_basic_logs" {
  role       = aws_iam_role.cart_service_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "cart_service_policy" {
  name = "CartServicePolicy-${var.environment}"
  role = aws_iam_role.cart_service_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "CartOperations"
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem"
        ]
        Resource = [
          aws_dynamodb_table.carts.arn,
          "${aws_dynamodb_table.carts.arn}/*"
        ]
      },
      {
        Sid    = "ReadProductStockAndPrice"
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem"
        ]
        Resource = [
          aws_dynamodb_table.products.arn,
          "${aws_dynamodb_table.products.arn}/*"
        ]
      }
    ]
  })
}

# ------------------------------------------------------------------------------
# 1.3 Order Service Role & Policy (Quản lý Đơn hàng & Phát sự kiện EventBridge)
# ------------------------------------------------------------------------------
resource "aws_iam_role" "order_service_role" {
  name               = "OrderServiceRole-${var.environment}"
  assume_role_policy = local.lambda_assume_role_policy

  tags = {
    Name        = "OrderServiceRole-${var.environment}"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

resource "aws_iam_role_policy_attachment" "order_basic_logs" {
  role       = aws_iam_role.order_service_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "order_service_policy" {
  name = "OrderServicePolicy-${var.environment}"
  role = aws_iam_role.order_service_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "OrderManagement"
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:Query"
        ]
        Resource = [
          aws_dynamodb_table.orders.arn,
          "${aws_dynamodb_table.orders.arn}/*"
        ]
      },
      {
        Sid    = "CartAccessOrder"
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:DeleteItem"
        ]
        Resource = [
          aws_dynamodb_table.carts.arn,
          "${aws_dynamodb_table.carts.arn}/*"
        ]
      },
      {
        Sid    = "ReadProductPrice"
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem"
        ]
        Resource = [
          aws_dynamodb_table.products.arn,
          "${aws_dynamodb_table.products.arn}/*"
        ]
      },
      {
        Sid    = "PublishOrderPlacedEvent"
        Effect = "Allow"
        Action = [
          "events:PutEvents"
        ]
        Resource = [
          aws_cloudwatch_event_bus.ecommerce_bus.arn
        ]
      }
    ]
  })
}

# ------------------------------------------------------------------------------
# 1.4 Payment Webhook Role & Policy (Cập nhật PAID & Bắn sự kiện PaymentConfirmed)
# ------------------------------------------------------------------------------
resource "aws_iam_role" "payment_webhook_role" {
  name               = "PaymentWebhookRole-${var.environment}"
  assume_role_policy = local.lambda_assume_role_policy

  tags = {
    Name        = "PaymentWebhookRole-${var.environment}"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

resource "aws_iam_role_policy_attachment" "payment_webhook_basic_logs" {
  role       = aws_iam_role.payment_webhook_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "payment_webhook_policy" {
  name = "PaymentWebhookPolicy-${var.environment}"
  role = aws_iam_role.payment_webhook_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "UpdateOrderPaymentStatus"
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:UpdateItem",
          "dynamodb:Query"
        ]
        Resource = [
          aws_dynamodb_table.orders.arn,
          "${aws_dynamodb_table.orders.arn}/*"
        ]
      },
      {
        Sid    = "PublishPaymentConfirmedEvent"
        Effect = "Allow"
        Action = [
          "events:PutEvents"
        ]
        Resource = [
          aws_cloudwatch_event_bus.ecommerce_bus.arn
        ]
      }
    ]
  })
}

# ------------------------------------------------------------------------------
# 1.5 User Profile Service Role & Policy (Hồ sơ, Địa chỉ, Garage của User)
# ------------------------------------------------------------------------------
resource "aws_iam_role" "user_service_role" {
  name               = "UserProfileRole-${var.environment}"
  assume_role_policy = local.lambda_assume_role_policy

  tags = {
    Name        = "UserProfileRole-${var.environment}"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

resource "aws_iam_role_policy_attachment" "user_service_basic_logs" {
  role       = aws_iam_role.user_service_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "user_service_policy" {
  name = "UserProfilePolicy-${var.environment}"
  role = aws_iam_role.user_service_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "UserProfileOperations"
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem"
        ]
        Resource = [
          aws_dynamodb_table.users.arn,
          "${aws_dynamodb_table.users.arn}/*"
        ]
      }
    ]
  })
}

# ------------------------------------------------------------------------------
# 1.6 Inventory Worker Role & Policy (SQS Consume & Trừ Tồn Kho Nguyên Tử)
# ------------------------------------------------------------------------------
resource "aws_iam_role" "inventory_worker_role" {
  name               = "InventoryWorkerRole-${var.environment}"
  assume_role_policy = local.lambda_assume_role_policy

  tags = {
    Name        = "InventoryWorkerRole-${var.environment}"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

resource "aws_iam_role_policy_attachment" "inventory_worker_basic_logs" {
  role       = aws_iam_role.inventory_worker_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "inventory_worker_policy" {
  name = "InventoryWorkerPolicy-${var.environment}"
  role = aws_iam_role.inventory_worker_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ConsumeInventoryQueue"
        Effect = "Allow"
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = [
          aws_sqs_queue.inventory_queue.arn
        ]
      },
      {
        Sid    = "UpdateProductInventory"
        Effect = "Allow"
        Action = [
          "dynamodb:UpdateItem"
        ]
        Resource = [
          aws_dynamodb_table.products.arn,
          "${aws_dynamodb_table.products.arn}/*"
        ]
      }
    ]
  })
}

# ------------------------------------------------------------------------------
# 1.7 Shipping Worker Role & Policy (SQS Consume & Cập nhật Vận đơn GHN)
# ------------------------------------------------------------------------------
resource "aws_iam_role" "shipping_worker_role" {
  name               = "ShippingWorkerRole-${var.environment}"
  assume_role_policy = local.lambda_assume_role_policy

  tags = {
    Name        = "ShippingWorkerRole-${var.environment}"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

resource "aws_iam_role_policy_attachment" "shipping_worker_basic_logs" {
  role       = aws_iam_role.shipping_worker_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "shipping_worker_policy" {
  name = "ShippingWorkerPolicy-${var.environment}"
  role = aws_iam_role.shipping_worker_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ConsumeShippingQueue"
        Effect = "Allow"
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = [
          aws_sqs_queue.shipping_queue.arn
        ]
      },
      {
        Sid    = "UpdateOrderShippingInfo"
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:UpdateItem",
          "dynamodb:Query"
        ]
        Resource = [
          aws_dynamodb_table.orders.arn,
          "${aws_dynamodb_table.orders.arn}/*"
        ]
      },
      {
        Sid    = "PublishShippingEvents"
        Effect = "Allow"
        Action = [
          "events:PutEvents"
        ]
        Resource = [
          aws_cloudwatch_event_bus.ecommerce_bus.arn
        ]
      }
    ]
  })
}

# ------------------------------------------------------------------------------
# 1.8 Notification Worker Role & Policy (SQS Consume & Gửi Mail Khách/Nhân viên)
# ------------------------------------------------------------------------------
resource "aws_iam_role" "notification_worker_role" {
  name               = "NotificationWorkerRole-${var.environment}"
  assume_role_policy = local.lambda_assume_role_policy

  tags = {
    Name        = "NotificationWorkerRole-${var.environment}"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

resource "aws_iam_role_policy_attachment" "notification_worker_basic_logs" {
  role       = aws_iam_role.notification_worker_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "notification_worker_policy" {
  name = "NotificationWorkerPolicy-${var.environment}"
  role = aws_iam_role.notification_worker_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ConsumeNotificationQueue"
        Effect = "Allow"
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = [
          aws_sqs_queue.notification_queue.arn
        ]
      },
      {
        Sid    = "ReadSmtpPasswordFromSSM"
        Effect = "Allow"
        Action = [
          "ssm:GetParameter",
          "ssm:GetParameters"
        ]
        Resource = [
          aws_ssm_parameter.smtp_password.arn
        ]
      }
    ]
  })
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
  role             = aws_iam_role.catalog_service_role.arn
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
      PRODUCTS_TABLE        = aws_dynamodb_table.products.name
      PRODUCT_IMAGES_BUCKET = aws_s3_bucket.product_images.bucket
      CDN_DOMAIN            = aws_cloudfront_distribution.main.domain_name
      ORIGIN_VERIFY_SECRET  = var.origin_verify_secret
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
  role             = aws_iam_role.cart_service_role.arn
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
      CARTS_TABLE          = aws_dynamodb_table.carts.name
      PRODUCTS_TABLE       = aws_dynamodb_table.products.name
      ORIGIN_VERIFY_SECRET = var.origin_verify_secret
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
  role             = aws_iam_role.order_service_role.arn
  runtime          = "python3.12"
  handler          = "lambda_function.lambda_handler"
  memory_size      = 512
  timeout          = 20
  filename         = data.archive_file.order_zip.output_path
  source_code_hash = data.archive_file.order_zip.output_base64sha256

  lifecycle {
    ignore_changes = [filename, source_code_hash, environment]
  }

  environment {
    variables = {
      ORDERS_TABLE         = aws_dynamodb_table.orders.name
      CARTS_TABLE          = aws_dynamodb_table.carts.name
      PRODUCTS_TABLE       = aws_dynamodb_table.products.name
      EVENT_BUS_NAME       = aws_cloudwatch_event_bus.ecommerce_bus.name
      ORIGIN_VERIFY_SECRET = var.origin_verify_secret
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
  role             = aws_iam_role.payment_webhook_role.arn
  runtime          = "python3.12"
  handler          = "lambda_function.lambda_handler"
  memory_size      = 256
  timeout          = 15
  filename         = data.archive_file.payment_zip.output_path
  source_code_hash = data.archive_file.payment_zip.output_base64sha256

  lifecycle {
    ignore_changes = [filename, source_code_hash, environment]
  }

  environment {
    variables = {
      ORDERS_TABLE         = aws_dynamodb_table.orders.name
      EVENT_BUS_NAME       = aws_cloudwatch_event_bus.ecommerce_bus.name
      ORIGIN_VERIFY_SECRET = var.origin_verify_secret
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
  role             = aws_iam_role.user_service_role.arn
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
      USERS_TABLE          = aws_dynamodb_table.users.name
      ORIGIN_VERIFY_SECRET = var.origin_verify_secret
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
  role             = aws_iam_role.inventory_worker_role.arn
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
      PRODUCTS_TABLE        = aws_dynamodb_table.products.name
      PRODUCT_IMAGES_BUCKET = aws_s3_bucket.product_images.bucket
      CDN_DOMAIN            = aws_cloudfront_distribution.main.domain_name
      ORIGIN_VERIFY_SECRET  = var.origin_verify_secret
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
  role             = aws_iam_role.shipping_worker_role.arn
  runtime          = "python3.12"
  handler          = "lambda_function.lambda_handler"
  memory_size      = 256
  timeout          = 30
  filename         = data.archive_file.shipping_zip.output_path
  source_code_hash = data.archive_file.shipping_zip.output_base64sha256

  lifecycle {
    ignore_changes = [filename, source_code_hash, environment]
  }

  environment {
    variables = {
      ORDERS_TABLE     = aws_dynamodb_table.orders.name
      EVENT_BUS_NAME   = aws_cloudwatch_event_bus.ecommerce_bus.name
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
  role             = aws_iam_role.notification_worker_role.arn
  runtime          = "python3.12"
  handler          = "lambda_function.lambda_handler"
  memory_size      = 256
  timeout          = 30
  filename         = data.archive_file.notification_zip.output_path
  source_code_hash = data.archive_file.notification_zip.output_base64sha256

  lifecycle {
    ignore_changes = [filename, source_code_hash, environment]
  }

  environment {
    variables = {
      SMTP_SERVER         = "smtp.gmail.com"
      SMTP_PORT           = "465"
      SMTP_PASSWORD_PARAM = aws_ssm_parameter.smtp_password.name
      STAFF_EMAIL         = "lointt1199@gmail.com"
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
