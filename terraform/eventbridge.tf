################################################################################
# EVENTBRIDGE: EVENT BUS & NOTIFICATION ROUTING (KHUNG 2 - REPLICA)
################################################################################

locals {
  bus_name = var.environment == "prod" ? "ecommerce-event-bus" : "ecommerce-event-bus-${var.environment}"
}

# 1. Custom Event Bus cho Thương mại điện tử
resource "aws_cloudwatch_event_bus" "ecommerce_bus" {
  name = local.bus_name

  tags = {
    Name        = local.bus_name
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# ------------------------------------------------------------------------------
# 2. Rule & Target: Notification Queue
# ------------------------------------------------------------------------------
resource "aws_cloudwatch_event_rule" "order_notification_rule" {
  name           = "order-notification-rule-${var.environment}"
  event_bus_name = aws_cloudwatch_event_bus.ecommerce_bus.name
  description    = "Bat su kien OrderPlaced va PaymentSuccess de gui email thong bao"

  event_pattern = jsonencode({
    source      = ["ecommerce.orders", "ecommerce.payments"]
    detail-type = ["OrderPlaced", "PaymentSuccess", "OrderCancelled"]
  })

  tags = {
    Name        = "order-notification-rule-${var.environment}"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_event_target" "notification_target" {
  rule           = aws_cloudwatch_event_rule.order_notification_rule.name
  event_bus_name = aws_cloudwatch_event_bus.ecommerce_bus.name
  target_id      = "NotificationQueueTarget"
  arn            = aws_sqs_queue.notification_queue.arn
}

resource "aws_sqs_queue_policy" "notification_queue_policy" {
  queue_url = aws_sqs_queue.notification_queue.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowEventBridgeToSendMessages"
        Effect    = "Allow"
        Principal = {
          Service = "events.amazonaws.com"
        }
        Action   = "sqs:SendMessage"
        Resource = aws_sqs_queue.notification_queue.arn
        Condition = {
          ArnEquals = {
            "aws:SourceArn" = aws_cloudwatch_event_rule.order_notification_rule.arn
          }
        }
      }
    ]
  })
}

# ------------------------------------------------------------------------------
# 3. Rule & Target: Inventory Queue
# ------------------------------------------------------------------------------
resource "aws_cloudwatch_event_rule" "order_inventory_rule" {
  name           = "order-inventory-rule-${var.environment}"
  event_bus_name = aws_cloudwatch_event_bus.ecommerce_bus.name
  description    = "Bat su kien OrderPlaced, PaymentSuccess va OrderCancelled de cap nhat ton kho"

  event_pattern = jsonencode({
    source      = ["ecommerce.orders", "ecommerce.payments"]
    detail-type = ["OrderPlaced", "PaymentSuccess", "OrderCancelled"]
  })

  tags = {
    Name        = "order-inventory-rule-${var.environment}"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_event_target" "inventory_target" {
  rule           = aws_cloudwatch_event_rule.order_inventory_rule.name
  event_bus_name = aws_cloudwatch_event_bus.ecommerce_bus.name
  target_id      = "InventoryQueueTarget"
  arn            = aws_sqs_queue.inventory_queue.arn
}

resource "aws_sqs_queue_policy" "inventory_queue_policy" {
  queue_url = aws_sqs_queue.inventory_queue.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowEventBridgeToSendInventoryMessages"
        Effect    = "Allow"
        Principal = {
          Service = "events.amazonaws.com"
        }
        Action   = "sqs:SendMessage"
        Resource = aws_sqs_queue.inventory_queue.arn
        Condition = {
          ArnEquals = {
            "aws:SourceArn" = aws_cloudwatch_event_rule.order_inventory_rule.arn
          }
        }
      }
    ]
  })
}

# ------------------------------------------------------------------------------
# 4. Rule & Target: Shipping Queue
# ------------------------------------------------------------------------------
resource "aws_cloudwatch_event_rule" "order_shipping_rule" {
  name           = "order-shipping-rule-${var.environment}"
  event_bus_name = aws_cloudwatch_event_bus.ecommerce_bus.name
  description    = "Chuyen su kien don hang sang ShippingWorker de tao van don GHN"

  event_pattern = jsonencode({
    source      = ["ecommerce.orders", "ecommerce.payments", "ecommerce.payment"]
    detail-type = ["OrderPlaced", "PaymentSuccess", "OrderCancelled"]
  })

  tags = {
    Name        = "order-shipping-rule-${var.environment}"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_event_target" "shipping_target" {
  rule           = aws_cloudwatch_event_rule.order_shipping_rule.name
  event_bus_name = aws_cloudwatch_event_bus.ecommerce_bus.name
  target_id      = "ShippingQueueTarget"
  arn            = aws_sqs_queue.shipping_queue.arn
}

resource "aws_sqs_queue_policy" "shipping_queue_policy" {
  queue_url = aws_sqs_queue.shipping_queue.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowEventBridgeToSendShippingMessages"
        Effect    = "Allow"
        Principal = {
          Service = "events.amazonaws.com"
        }
        Action   = "sqs:SendMessage"
        Resource = aws_sqs_queue.shipping_queue.arn
        Condition = {
          ArnEquals = {
            "aws:SourceArn" = aws_cloudwatch_event_rule.order_shipping_rule.arn
          }
        }
      }
    ]
  })
}
