terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Remote state in S3 — create this bucket manually before first apply
  backend "s3" {
    bucket         = "vrdcapital-terraform-state"
    key            = "prod/terraform.tfstate"
    region         = "ap-south-1"
    dynamodb_table = "vrdcapital-terraform-locks"
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "vrdcapital"
      Environment = "prod"
      ManagedBy   = "terraform"
    }
  }
}

# ── Modules ────────────────────────────────────────────────────────────────

module "vpc" {
  source = "../../modules/vpc"

  project     = var.project
  environment = var.environment
  aws_region  = var.aws_region
  vpc_cidr    = var.vpc_cidr
}

module "iam" {
  source = "../../modules/iam"

  project          = var.project
  environment      = var.environment
  eks_cluster_name = "${var.project}-${var.environment}"
}

module "eks" {
  source = "../../modules/eks"

  project          = var.project
  environment      = var.environment
  aws_region       = var.aws_region
  cluster_name     = "${var.project}-${var.environment}"
  k8s_version      = var.k8s_version
  vpc_id           = module.vpc.vpc_id
  private_subnets  = module.vpc.private_subnet_ids
  node_role_arn    = module.iam.node_role_arn
  cluster_role_arn = module.iam.cluster_role_arn
  node_instance_type = var.node_instance_type
  node_min         = var.node_min
  node_max         = var.node_max
  node_desired     = var.node_desired
}

module "ecr" {
  source = "../../modules/ecr"

  project     = var.project
  environment = var.environment
  services    = var.services
}

module "rds" {
  source = "../../modules/rds"

  project             = var.project
  environment         = var.environment
  vpc_id              = module.vpc.vpc_id
  private_subnets     = module.vpc.private_subnet_ids
  eks_security_group  = module.eks.node_security_group_id
  jenkins_sg_id       = module.jenkins.security_group_id
  db_instance_class   = var.db_instance_class
  db_name             = var.db_name
  db_username         = var.db_username
  db_password         = var.db_password
}

module "elasticache" {
  source = "../../modules/elasticache"

  project            = var.project
  environment        = var.environment
  vpc_id             = module.vpc.vpc_id
  private_subnets    = module.vpc.private_subnet_ids
  eks_security_group = module.eks.node_security_group_id
  redis_node_type    = var.redis_node_type
  auth_token         = var.redis_auth_token
}

module "s3" {
  source = "../../modules/s3"

  project     = var.project
  environment = var.environment
}

module "secrets" {
  source = "../../modules/secrets"

  project            = var.project
  environment        = var.environment
  db_username        = var.db_username
  db_password        = var.db_password
  db_host            = module.rds.endpoint
  db_name            = var.db_name
  redis_host         = module.elasticache.endpoint
  redis_auth_token   = var.redis_auth_token
  rabbitmq_user      = var.rabbitmq_user
  rabbitmq_password  = var.rabbitmq_password
  secret_key         = var.app_secret_key
  zerodha_api_key    = var.zerodha_api_key
  zerodha_api_secret = var.zerodha_api_secret
  grafana_password   = var.grafana_password
}

module "jenkins" {
  source = "../../modules/jenkins"

  project           = var.project
  environment       = var.environment
  aws_region        = var.aws_region
  vpc_id            = module.vpc.vpc_id
  public_subnet_id  = module.vpc.public_subnet_ids[0]
  instance_type     = "t3.medium"
  key_name          = var.jenkins_key_name
  ecr_registry_url  = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${var.aws_region}.amazonaws.com"
  eks_cluster_name  = module.eks.cluster_name
}

# ALB DNS name is assigned by the AWS Load Balancer Controller after the
# Ingress resource is applied. Read it back via a data source so Terraform
# can wire it to the DNS module without manual copy-paste.
# NOTE: This data source works only after the ALB exists (after k8s apply).
#       On first apply, set alb_dns_name_override in terraform.tfvars instead.
data "aws_lb" "vrdcapital" {
  count = var.alb_dns_name_override == "" ? 1 : 0
  tags = {
    "ingress.k8s.aws/stack" = "vrdcapital/vrdcapital-ingress"
  }
}

locals {
  alb_dns_name = var.alb_dns_name_override != "" ? var.alb_dns_name_override : (
    length(data.aws_lb.vrdcapital) > 0 ? data.aws_lb.vrdcapital[0].dns_name : ""
  )
}

module "dns" {
  source = "../../modules/dns"

  project      = var.project
  environment  = var.environment
  domain       = var.domain
  alb_dns_name = local.alb_dns_name
}

module "irsa" {
  source = "../../modules/irsa"

  project             = var.project
  environment         = var.environment
  aws_account_id      = data.aws_caller_identity.current.account_id
  aws_region          = var.aws_region
  oidc_provider_url   = module.eks.oidc_issuer_url
  reports_bucket_name = module.s3.bucket_name
}

data "aws_caller_identity" "current" {}
