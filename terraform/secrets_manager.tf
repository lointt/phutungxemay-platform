################################################################################
# AWS SECRETS MANAGER - QUẢN LÝ BẢO MẬT TẬP TRUNG (THAY THẾ SSM PARAMETER STORE)
################################################################################

# 1. Google Gemini API Key (Dùng cho Chatbot RAG & Vector Embedding)
resource "aws_secretsmanager_secret" "gemini_api_key" {
  name                    = "chatbot/gemini_api_key_${var.environment}"
  description             = "Google Gemini API Key cho Chatbot RAG va Vector Embedding"
  recovery_window_in_days = 0

  tags = {
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

resource "aws_secretsmanager_secret_version" "gemini_api_key_val" {
  secret_id = aws_secretsmanager_secret.gemini_api_key.id
  secret_string = jsonencode({
    GEMINI_API_KEY = "AIzaSy_DEFAULT_KEY"
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}

# 2. Cổng thanh toán VNPAY (TMN Code & Hash Secret)
resource "aws_secretsmanager_secret" "vnpay_secrets" {
  name                    = "ecommerce/vnpay_${var.environment}"
  description             = "VNPAY Terminal Code va Hash Secret Key cho cong thanh toan"
  recovery_window_in_days = 0

  tags = {
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

resource "aws_secretsmanager_secret_version" "vnpay_secrets_val" {
  secret_id = aws_secretsmanager_secret.vnpay_secrets.id
  secret_string = jsonencode({
    VNPAY_TMN_CODE    = "VNPAY_TMN_DEFAULT"
    VNPAY_HASH_SECRET = "VNPAY_SECRET_DEFAULT"
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}

# 3. Shipping Provider API Key (GHN / Giao Hàng Nhanh)
resource "aws_secretsmanager_secret" "shipping_api_key" {
  name                    = "ecommerce/shipping_api_key_${var.environment}"
  description             = "API Token / Key doi tac giao van GHN"
  recovery_window_in_days = 0

  tags = {
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

resource "aws_secretsmanager_secret_version" "shipping_api_key_val" {
  secret_id = aws_secretsmanager_secret.shipping_api_key.id
  secret_string = jsonencode({
    SHIPPING_API_KEY = "SHIPPING_API_KEY_DEFAULT"
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}

# 4. Gmail SMTP Password (Dùng cho Notification Worker)
resource "aws_secretsmanager_secret" "smtp_password" {
  name                    = "ecommerce/smtp_password_${var.environment}"
  description             = "Mat khau ung dung Gmail SMTP cho NotificationWorker"
  recovery_window_in_days = 0

  tags = {
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

resource "aws_secretsmanager_secret_version" "smtp_password_val" {
  secret_id = aws_secretsmanager_secret.smtp_password.id
  secret_string = jsonencode({
    SMTP_PASSWORD = "vzjlptdpcbkdmjyv"
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}
