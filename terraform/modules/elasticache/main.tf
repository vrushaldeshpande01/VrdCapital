# ElastiCache Redis 7 — replaces containerised Redis

locals {
  name_prefix = "${var.project}-${var.environment}"
}

resource "aws_elasticache_subnet_group" "main" {
  name       = "${local.name_prefix}-redis-subnet"
  subnet_ids = var.private_subnets
  tags       = { Name = "${local.name_prefix}-redis-subnet-group" }
}

resource "aws_security_group" "redis" {
  name        = "${local.name_prefix}-redis-sg"
  description = "Allow Redis from EKS nodes only"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Redis from EKS nodes"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [var.eks_security_group]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${local.name_prefix}-redis-sg" }
}

resource "aws_elasticache_replication_group" "main" {
  replication_group_id = "${local.name_prefix}-redis"
  description          = "VrdCapital Redis cache"

  node_type            = var.redis_node_type
  port                 = 6379
  parameter_group_name = "default.redis7"
  engine_version       = "7.1"

  num_cache_clusters   = 2

  subnet_group_name    = aws_elasticache_subnet_group.main.name
  security_group_ids   = [aws_security_group.redis.id]

  at_rest_encryption_enabled  = true
  transit_encryption_enabled  = true
  auth_token                  = var.auth_token

  automatic_failover_enabled   = true

  tags = { Name = "${local.name_prefix}-redis" }
}
