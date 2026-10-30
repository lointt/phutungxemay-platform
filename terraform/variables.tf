variable "aws_region" {
  description = "AWS Region triển khai hạ tầng"
  type        = string
  default     = "ap-southeast-1"
}

variable "environment" {
  description = "Môi trường triển khai (replica / prod / staging / dev)"
  type        = string
  default     = "replica"
}

variable "project_name" {
  description = "Tên định danh dự án"
  type        = string
  default     = "phutungxemay"
}

variable "hosting_bucket_name" {
  description = "Tên S3 Bucket lưu trữ Static Assets Frontend (_next/static)"
  type        = string
  default     = "phutungxemay-frontend-replica-2026"
}
