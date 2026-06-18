variable "project" {
  description = "Project name prefix for resource naming"
  type        = string
}

variable "environment" {
  description = "Deployment environment (prod, staging)"
  type        = string
}

variable "aws_account_id" {
  description = "AWS account ID used to build ARNs"
  type        = string
  sensitive   = true
}

variable "aws_region" {
  description = "AWS region where Secrets Manager secrets live"
  type        = string
}

variable "oidc_provider_url" {
  description = "OIDC issuer URL from the EKS cluster (eks module output)"
  type        = string
}

variable "reports_bucket_name" {
  description = "S3 bucket name that report-service writes reports to"
  type        = string
}
