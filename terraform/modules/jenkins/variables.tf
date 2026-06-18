variable "project"          { type = string }
variable "environment"      { type = string }
variable "aws_region"       { type = string }
variable "vpc_id"           { type = string }
variable "public_subnet_id" { type = string }
variable "key_name"         { type = string }
variable "ecr_registry_url" { type = string }
variable "eks_cluster_name" { type = string }

variable "instance_type" {
  type    = string
  default = "t3.medium"
}
