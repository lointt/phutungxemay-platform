################################################################################
# AWS SYSTEMS MANAGER (SSM) PARAMETER STORE - TẬP TRUNG SECRETS & CONFIG
################################################################################

# 1. Google Gemini API Key (Dùng cho RAG Chatbot & Embedding)
# Đọc trực tiếp từ SSM Parameter Store đã có sẵn trên tài khoản AWS của bạn
data "aws_ssm_parameter" "gemini_api_key" {
  name = "/chatbot/gemini_api_key"
}

# 2. VNPAY Terminal Code (TMN Code)
resource "aws_ssm_parameter" "vnpay_tmn_code" {
  name        = "/ecommerce/vnpay_tmn_code"
  description = "VNPAY Terminal Code cho cổng thanh toán VNPay"
  type        = "String"
  value       = "VNPAY_TMN_DEFAULT"

  lifecycle {
    ignore_changes = [value]
  }

  tags = {
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# 3. VNPAY Hash Secret
resource "aws_ssm_parameter" "vnpay_hash_secret" {
  name        = "/ecommerce/vnpay_hash_secret"
  description = "VNPAY Hash Secret Key (HMAC-SHA512) xác thực giao dịch"
  type        = "SecureString"
  value       = "VNPAY_SECRET_DEFAULT"

  lifecycle {
    ignore_changes = [value]
  }

  tags = {
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# 4. Shipping Provider API Key
resource "aws_ssm_parameter" "shipping_api_key" {
  name        = "/ecommerce/shipping_api_key"
  description = "API Key đối tác giao vận / vận chuyển"
  type        = "SecureString"
  value       = "SHIPPING_API_KEY_DEFAULT"

  lifecycle {
    ignore_changes = [value]
  }

  tags = {
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}
