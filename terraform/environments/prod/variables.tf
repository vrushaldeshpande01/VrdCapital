variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "ap-south-1"
}

variable "project" {
  description = "Project name used as prefix for all resources"
  type        = string
  default     = "vrdcapital"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "prod"
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "k8s_version" {
  description = "Kubernetes version for EKS"
  type        = string
  default     = "1.29"
}

variable "node_instance_type" {
  description = "EC2 instance type for EKS worker nodes"
  type        = string
  default     = "t3.medium"
}

variable "node_min" {
  description = "Minimum number of EKS worker nodes"
  type        = number
  default     = 2
}

variable "node_max" {
  description = "Maximum number of EKS worker nodes (for HPA scale-out)"
  type        = number
  default     = 5
}

variable "node_desired" {
  description = "Desired number of EKS worker nodes"
  type        = number
  default     = 2
}

variable "services" {
  description = "List of microservices — one ECR repo will be created per service"
  type        = list(string)
  default     = [
    "auth-service",
    "client-service",
    "portfolio-service",
    "broker-service",
    "order-service",
    "notification-service",
    "report-service",
    "frontend",
  ]
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro"
}

variable "db_name" {
  description = "PostgreSQL database name"
  type        = string
  default     = "vrdcapital"
}

variable "db_username" {
  description = "PostgreSQL master username"
  type        = string
  sensitive   = true
}

variable "db_password" {
  description = "PostgreSQL master password"
  type        = string
  sensitive   = true
}

variable "redis_node_type" {
  description = "ElastiCache Redis node type"
  type        = string
  default     = "cache.t3.micro"
}

variable "redis_auth_token" {
  description = "ElastiCache Redis AUTH token (password)"
  type        = string
  sensitive   = true
}

variable "rabbitmq_user" {
  description = "RabbitMQ username (stored in Secrets Manager)"
  type        = string
  default     = "vrdcapital"
}

variable "rabbitmq_password" {
  description = "RabbitMQ password (stored in Secrets Manager)"
  type        = string
  sensitive   = true
}

variable "app_secret_key" {
  description = "JWT signing secret key (min 32 chars)"
  type        = string
  sensitive   = true
}

variable "zerodha_api_key" {
  description = "Zerodha Kite Connect API key"
  type        = string
  sensitive   = true
}

variable "zerodha_api_secret" {
  description = "Zerodha Kite Connect API secret"
  type        = string
  sensitive   = true
}

variable "grafana_password" {
  description = "Grafana admin password"
  type        = string
  sensitive   = true
}

variable "jenkins_key_name" {
  description = "EC2 Key Pair name for SSH access to Jenkins (create in AWS console first)"
  type        = string
}

variable "domain" {
  description = "Root domain name for the app (e.g. vrdcapital.in). Leave empty until domain is purchased."
  type        = string
  default     = ""
}

variable "alb_dns_name_override" {
  description = "Manually set the ALB DNS name (copy from: kubectl get ingress -n vrdcapital). Required when domain is set but the data source can't resolve the ALB yet."
  type        = string
  default     = ""
}
