################################################################################
# AMAZON COGNITO: IDENTITY PROVIDER & AUTHENTICATION (KHUNG 1 & 2 - REPLICA)
################################################################################

locals {
  user_pool_name = var.environment == "prod" ? "MotorcycleEcommerceUserPool" : "MotorcycleEcommerceUserPool-${title(var.environment)}"
  client_name    = var.environment == "prod" ? "MotorcycleWebClient" : "MotorcycleWebClient-${title(var.environment)}"
}

# 1. User Pool
resource "aws_cognito_user_pool" "pool" {
  name                     = local.user_pool_name
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_symbols   = false
    require_uppercase = true
  }

  admin_create_user_config {
    allow_admin_create_user_only = false
  }

  tags = {
    Name        = local.user_pool_name
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# 2. App Client cho Web SPA Frontend (Public Client, không dùng Client Secret)
resource "aws_cognito_user_pool_client" "client" {
  name         = local.client_name
  user_pool_id = aws_cognito_user_pool.pool.id

  generate_secret = false

  explicit_auth_flows = [
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_PASSWORD_AUTH"
  ]

  prevent_user_existence_errors = "ENABLED"
}

# 3. Phân nhóm quyền (RBAC Groups)
resource "aws_cognito_user_group" "admins" {
  name         = "Admins"
  user_pool_id = aws_cognito_user_pool.pool.id
  description  = "Quan tri vien he thong phutungxemay"
  precedence   = 1
}

resource "aws_cognito_user_group" "customers" {
  name         = "Customers"
  user_pool_id = aws_cognito_user_pool.pool.id
  description  = "Khach hang mua sam"
  precedence   = 2
}
