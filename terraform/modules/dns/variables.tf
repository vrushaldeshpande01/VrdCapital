variable "project" {
  description = "Project name prefix"
  type        = string
}

variable "environment" {
  description = "Deployment environment"
  type        = string
}

variable "domain" {
  description = "Root domain name (e.g. vrdcapital.in). Leave empty to skip DNS/TLS resources."
  type        = string
  default     = ""
}

variable "alb_dns_name" {
  description = "ALB DNS name from the AWS Load Balancer Controller (data source or hardcoded after first apply)"
  type        = string
}

variable "alb_zone_id" {
  description = "Hosted zone ID of the ALB (fixed per region — ap-south-1 is ZP97RAFLXTNZK)"
  type        = string
  default     = "ZP97RAFLXTNZK"
}
