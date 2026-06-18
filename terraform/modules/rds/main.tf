# RDS PostgreSQL 15 — replaces containerised PostgreSQL

locals {
  name_prefix = "${var.project}-${var.environment}"
}

resource "aws_db_subnet_group" "main" {
  name       = "${local.name_prefix}-db-subnet"
  subnet_ids = var.private_subnets
  tags       = { Name = "${local.name_prefix}-db-subnet-group" }
}

resource "aws_security_group" "rds" {
  name        = "${local.name_prefix}-rds-sg"
  description = "Allow PostgreSQL from EKS nodes and Jenkins"
  vpc_id      = var.vpc_id

  ingress {
    description     = "PostgreSQL from EKS nodes"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [var.eks_security_group]
  }

  ingress {
    description     = "PostgreSQL from Jenkins EC2"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [var.jenkins_sg_id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${local.name_prefix}-rds-sg" }
}

resource "aws_db_instance" "main" {
  identifier              = "${local.name_prefix}-postgres"
  engine                  = "postgres"
  engine_version          = "15.5"
  instance_class          = var.db_instance_class
  allocated_storage       = 20
  max_allocated_storage   = 100
  storage_type            = "gp3"
  storage_encrypted       = true

  db_name  = var.db_name
  username = var.db_username
  password = var.db_password

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  backup_retention_period = 7
  backup_window           = "03:00-04:00"
  maintenance_window      = "Mon:04:00-Mon:05:00"

  deletion_protection     = true
  skip_final_snapshot     = false
  final_snapshot_identifier = "${local.name_prefix}-final-snapshot"

  performance_insights_enabled = true

  tags = { Name = "${local.name_prefix}-postgres" }
}
