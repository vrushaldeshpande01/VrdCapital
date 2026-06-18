variable "project" {
  type = string
}

variable "environment" {
  type = string
}

variable "aws_region" {
  type = string
}

variable "cluster_name" {
  type = string
}

variable "k8s_version" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "private_subnets" {
  type = list(string)
}

variable "cluster_role_arn" {
  type = string
}

variable "node_role_arn" {
  type = string
}

variable "node_instance_type" {
  type = string
}

variable "node_min" {
  type = number
}

variable "node_max" {
  type = number
}

variable "node_desired" {
  type = number
}
