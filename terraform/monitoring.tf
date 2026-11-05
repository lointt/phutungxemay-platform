################################################################################
# AMAZON CLOUDWATCH OBSERVABILITY, METRICS & ALERTS (KHUNG GIÁM SÁT TOÀN DIỆN)
################################################################################

locals {
  monitoring_env_title = title(var.environment)
}

# ==============================================================================
# 1. AMAZON SNS ALERT TOPIC (KÊNH PHÁT THÔNG BÁO SỰ CỐ TẬP TRUNG)
# ==============================================================================
resource "aws_sns_topic" "system_alerts" {
  name         = "ecommerce-system-alerts-${var.environment}"
  display_name = "PhuTungXeMay Alerts [${local.monitoring_env_title}]"

  tags = {
    Name        = "ecommerce-system-alerts-${var.environment}"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# Tùy chọn đăng ký Email quản trị viên nếu có cấu hình
resource "aws_sns_topic_subscription" "admin_email_alert" {
  count     = var.alert_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.system_alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# ==============================================================================
# 2. CLOUDWATCH METRIC ALARMS (CẢNH BÁO TỰ ĐỘNG CÁC CHỈ SỐ QUAN TRỌNG)
# ==============================================================================

# 2.1 Báo động khẩn cấp: Phát hiện có tin nhắn trong Notification DLQ
resource "aws_cloudwatch_metric_alarm" "notification_dlq_alarm" {
  alarm_name          = "Notification-DLQ-Has-Messages-${var.environment}"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 60
  statistic           = "Maximum"
  threshold           = 1
  alarm_description   = "Cảnh báo khẩn: Có email/thông báo thất bại bị văng vào Notification DLQ!"
  alarm_actions       = [aws_sns_topic.system_alerts.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    QueueName = aws_sqs_queue.notification_dlq.name
  }

  tags = {
    Environment = var.environment
    Severity    = "CRITICAL"
  }
}

# 3.2 Báo động: Phát hiện có bản ghi CDC bị lỗi trong Chatbot Sync DLQ
resource "aws_cloudwatch_metric_alarm" "sync_dlq_alarm" {
  alarm_name          = "ChatbotSync-DLQ-Has-Messages-${var.environment}"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 60
  statistic           = "Maximum"
  threshold           = 1
  alarm_description   = "Cảnh báo: Có bản ghi DynamoDB CDC thất bại khi đồng bộ Vector KB!"
  alarm_actions       = [aws_sns_topic.system_alerts.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    QueueName = aws_sqs_queue.sync_dlq.name
  }

  tags = {
    Environment = var.environment
    Severity    = "WARNING"
  }
}

# 3.3 Báo động: Lỗi thực thi tại Order Service Handler (Ảnh hưởng tạo đơn hàng)
resource "aws_cloudwatch_metric_alarm" "order_service_errors" {
  alarm_name          = "OrderService-Errors-${var.environment}"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 1
  alarm_description   = "Lỗi runtime xảy ra tại OrderServiceHandler!"
  alarm_actions       = [aws_sns_topic.system_alerts.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.order_service.function_name
  }

  tags = {
    Environment = var.environment
    Severity    = "HIGH"
  }
}

# 3.4 Báo động: Lỗi xử lý Webhook thanh toán VNPay
resource "aws_cloudwatch_metric_alarm" "payment_webhook_errors" {
  alarm_name          = "PaymentWebhook-Errors-${var.environment}"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 1
  alarm_description   = "Lỗi xử lý xác thực thanh toán tại PaymentWebhookHandler!"
  alarm_actions       = [aws_sns_topic.system_alerts.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.payment_webhook.function_name
  }

  tags = {
    Environment = var.environment
    Severity    = "CRITICAL"
  }
}

# 3.5 Báo động: Lỗi 5XX trên toàn bộ REST API Gateway
resource "aws_cloudwatch_metric_alarm" "api_5xx_errors" {
  alarm_name          = "RestApi-5XX-Errors-${var.environment}"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "5XXError"
  namespace           = "AWS/ApiGateway"
  period              = 300
  statistic           = "Sum"
  threshold           = 3
  alarm_description   = "Tỷ lệ lỗi 5XX vượt ngưỡng an toàn trên REST API Gateway!"
  alarm_actions       = [aws_sns_topic.system_alerts.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    ApiName = aws_api_gateway_rest_api.rest_api.name
    Stage   = aws_api_gateway_stage.prod.stage_name
  }

  tags = {
    Environment = var.environment
    Severity    = "HIGH"
  }
}

# 3.6 Báo động: Chat Orchestrator gặp sự cố hoặc timeout
resource "aws_cloudwatch_metric_alarm" "chat_orchestrator_errors" {
  alarm_name          = "ChatOrchestrator-Errors-${var.environment}"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 2
  alarm_description   = "Chat Orchestrator gặp lỗi khi xử lý RAG hoặc gọi Gemini AI!"
  alarm_actions       = [aws_sns_topic.system_alerts.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.chat_orchestrator.function_name
  }

  tags = {
    Environment = var.environment
    Severity    = "MEDIUM"
  }
}

# ==============================================================================
# 3. CLOUDWATCH DASHBOARD (BẢNG ĐIỀU KHIỂN GIÁM SÁT TRỰC QUAN TẬP TRUNG)
# ==============================================================================
resource "aws_cloudwatch_dashboard" "ecommerce_dashboard" {
  dashboard_name = "Ecommerce-System-Overview-${local.monitoring_env_title}"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        properties = {
          title   = "REST API Traffic & Errors"
          period  = 300
          stat    = "Sum"
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          metrics = [
            ["AWS/ApiGateway", "Count", "ApiName", aws_api_gateway_rest_api.rest_api.name, { label = "Total Requests", color = "#1f77b4" }],
            [".", "4XXError", ".", ".", { label = "4XX Client Errors", color = "#ff7f0e" }],
            [".", "5XXError", ".", ".", { label = "5XX Server Errors", color = "#d62728" }]
          ]
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6
        properties = {
          title  = "REST API Latency (ms)"
          period = 300
          stat   = "Average"
          view   = "timeSeries"
          region = var.aws_region
          metrics = [
            ["AWS/ApiGateway", "Latency", "ApiName", aws_api_gateway_rest_api.rest_api.name, { label = "Avg Latency", color = "#2ca02c" }],
            [".", "IntegrationLatency", ".", ".", { label = "Integration Latency", color = "#9467bd" }]
          ]
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6
        properties = {
          title  = "SQS Queues - Messages Processing"
          period = 300
          stat   = "Maximum"
          view   = "timeSeries"
          region = var.aws_region
          metrics = [
            ["AWS/SQS", "ApproximateNumberOfMessagesVisible", "QueueName", aws_sqs_queue.inventory_queue.name, { label = "Inventory Queue" }],
            [".", ".", "QueueName", aws_sqs_queue.shipping_queue.name, { label = "Shipping Queue" }],
            [".", ".", "QueueName", aws_sqs_queue.notification_queue.name, { label = "Notification Queue" }]
          ]
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 6
        width  = 12
        height = 6
        properties = {
          title  = "SQS Dead Letter Queues (DLQ Status)"
          period = 60
          stat   = "Maximum"
          view   = "timeSeries"
          region = var.aws_region
          metrics = [
            ["AWS/SQS", "ApproximateNumberOfMessagesVisible", "QueueName", aws_sqs_queue.notification_dlq.name, { label = "Notification DLQ", color = "#d62728" }],
            [".", ".", "QueueName", aws_sqs_queue.sync_dlq.name, { label = "Chatbot Sync DLQ", color = "#e377c2" }]
          ]
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 12
        width  = 24
        height = 6
        properties = {
          title  = "Lambda Errors Overview"
          period = 300
          stat   = "Sum"
          view   = "timeSeries"
          region = var.aws_region
          metrics = [
            ["AWS/Lambda", "Errors", "FunctionName", aws_lambda_function.order_service.function_name, { label = "OrderService" }],
            [".", ".", "FunctionName", aws_lambda_function.payment_webhook.function_name, { label = "PaymentWebhook" }],
            [".", ".", "FunctionName", aws_lambda_function.catalog_service.function_name, { label = "CatalogService" }],
            [".", ".", "FunctionName", aws_lambda_function.chat_orchestrator.function_name, { label = "ChatOrchestrator" }],
            [".", ".", "FunctionName", aws_lambda_function.notification_worker.function_name, { label = "NotificationWorker" }]
          ]
        }
      }
    ]
  })
}
