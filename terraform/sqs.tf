################################################################################
# SQS QUEUES & DEAD-LETTER QUEUES (KHUNG 2: ASYNC EVENT PROCESSING - REPLICA)
################################################################################

locals {
  queue_suffix = var.environment == "prod" ? "" : "-${var.environment}"
}

# 1. Inventory Queue & DLQ
resource "aws_sqs_queue" "inventory_dlq" {
  name                      = "inventory-dlq${local.queue_suffix}"
  message_retention_seconds = 1209600 # 14 days

  tags = {
    Name        = "inventory-dlq${local.queue_suffix}"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

resource "aws_sqs_queue" "inventory_queue" {
  name                       = "inventory-processing-queue${local.queue_suffix}"
  message_retention_seconds  = 86400 # 1 day
  visibility_timeout_seconds = 30

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.inventory_dlq.arn
    maxReceiveCount     = 3
  })

  tags = {
    Name        = "inventory-processing-queue${local.queue_suffix}"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# 2. Shipping Queue & DLQ
resource "aws_sqs_queue" "shipping_dlq" {
  name                      = "shipping-dlq${local.queue_suffix}"
  message_retention_seconds = 1209600 # 14 days

  tags = {
    Name        = "shipping-dlq${local.queue_suffix}"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

resource "aws_sqs_queue" "shipping_queue" {
  name                       = "shipping-processing-queue${local.queue_suffix}"
  message_retention_seconds  = 86400 # 1 day
  visibility_timeout_seconds = 30

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.shipping_dlq.arn
    maxReceiveCount     = 3
  })

  tags = {
    Name        = "shipping-processing-queue${local.queue_suffix}"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# 3. Notification Queue & DLQ
resource "aws_sqs_queue" "notification_dlq" {
  name                      = "notification-dlq${local.queue_suffix}"
  message_retention_seconds = 1209600 # 14 days

  tags = {
    Name        = "notification-dlq${local.queue_suffix}"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

resource "aws_sqs_queue" "notification_queue" {
  name                       = "notification-processing-queue${local.queue_suffix}"
  message_retention_seconds  = 86400 # 1 day
  visibility_timeout_seconds = 30

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.notification_dlq.arn
    maxReceiveCount     = 3
  })

  tags = {
    Name        = "notification-processing-queue${local.queue_suffix}"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}
