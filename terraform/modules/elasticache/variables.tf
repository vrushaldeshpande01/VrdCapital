variable "project" {
  type = string
}

variable "environment" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "private_subnets" {
  type = list(string)
}

variable "eks_security_group" {
  type = string
}

variable "redis_node_type" {
  type = string
}

variable "auth_token" {
  type      = string
  sensitive = true
}
