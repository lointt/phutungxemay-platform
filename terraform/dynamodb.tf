################################################################################
# DYNAMODB TABLES (KHUNG 2: SERVERLESS DATA LAYER - REPLICA)
################################################################################

locals {
  table_suffix = var.environment == "prod" ? "" : "_${title(var.environment)}"
}

# 1. Bảng Products (Danh mục & kho phụ tùng xe máy)
resource "aws_dynamodb_table" "products" {
  name         = "Products${local.table_suffix}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "ProductID"

  attribute {
    name = "ProductID"
    type = "S"
  }

  stream_enabled   = true
  stream_view_type = "NEW_AND_OLD_IMAGES"

  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Name        = "DynamoDB-Products-${var.environment}"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# 2. Bảng Orders (Đơn hàng)
resource "aws_dynamodb_table" "orders" {
  name         = "Orders${local.table_suffix}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "UserID"
  range_key    = "OrderID"

  attribute {
    name = "UserID"
    type = "S"
  }

  attribute {
    name = "OrderID"
    type = "S"
  }

  global_secondary_index {
    name            = "OrderID-index"
    hash_key        = "OrderID"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Name        = "DynamoDB-Orders-${var.environment}"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# 3. Bảng Carts (Giỏ hàng người dùng)
resource "aws_dynamodb_table" "carts" {
  name         = "Carts${local.table_suffix}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "CartID"

  attribute {
    name = "CartID"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Name        = "DynamoDB-Carts-${var.environment}"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# 4. Bảng Users (Hồ sơ người dùng & Garage xe)
resource "aws_dynamodb_table" "users" {
  name         = "Users${local.table_suffix}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "UserID"

  attribute {
    name = "UserID"
    type = "S"
  }

  attribute {
    name = "phone"
    type = "S"
  }

  global_secondary_index {
    name            = "Phone-index"
    hash_key        = "phone"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Name        = "DynamoDB-Users-${var.environment}"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# 5. Bảng StorePolicies (Chính sách cửa hàng & Tri thức KB cho RAG Chatbot)
resource "aws_dynamodb_table" "store_policies" {
  name         = "StorePolicies${local.table_suffix}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PolicyID"

  attribute {
    name = "PolicyID"
    type = "S"
  }

  stream_enabled   = true
  stream_view_type = "NEW_AND_OLD_IMAGES"

  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Name        = "DynamoDB-StorePolicies-${var.environment}"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# 6. Bảng chatbot-sessions (Lịch sử hội thoại & Rate-limit cho Chatbot)
import {
  to = aws_dynamodb_table.chatbot_sessions
  id = "chatbot-sessions"
}

resource "aws_dynamodb_table" "chatbot_sessions" {
  name         = "chatbot-sessions"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "session_id"

  attribute {
    name = "session_id"
    type = "S"
  }

  ttl {
    attribute_name = "expires_at"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Name        = "DynamoDB-ChatbotSessions-${var.environment}"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}
