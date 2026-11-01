terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket  = "phutungxemay-terraform-state-replica-2026"
    key     = "replica/terraform.tfstate"
    region  = "ap-southeast-1"
    encrypt = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "MotorcyclePartsEcommerce"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}
