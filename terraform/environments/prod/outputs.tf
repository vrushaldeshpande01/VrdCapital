output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "eks_cluster_name" {
  description = "EKS cluster name — use with: aws eks update-kubeconfig --name <value> --region ap-south-1"
  value       = module.eks.cluster_name
}

output "eks_cluster_endpoint" {
  description = "EKS API server endpoint"
  value       = module.eks.cluster_endpoint
}

output "ecr_registry_url" {
  description = "ECR registry base URL (prefix all image URIs with this)"
  value       = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${var.aws_region}.amazonaws.com"
}

output "ecr_repo_urls" {
  description = "Map of service name to ECR repository URL"
  value       = module.ecr.repo_urls
}

output "rds_endpoint" {
  description = "RDS PostgreSQL endpoint"
  value       = module.rds.endpoint
  sensitive   = true
}

output "redis_endpoint" {
  description = "ElastiCache Redis primary endpoint"
  value       = module.elasticache.endpoint
  sensitive   = true
}

output "s3_bucket_name" {
  description = "S3 bucket for reports and static assets"
  value       = module.s3.bucket_name
}

output "secrets_manager_arn" {
  description = "AWS Secrets Manager secret ARN (contains all app secrets)"
  value       = module.secrets.secret_arn
}

output "jenkins_public_ip" {
  description = "Jenkins EC2 public IP — open http://<ip>:8080 after first boot"
  value       = module.jenkins.public_ip
}

output "jenkins_ssh" {
  description = "SSH command for Jenkins EC2"
  value       = "ssh -i ~/.ssh/${var.jenkins_key_name}.pem ubuntu@${module.jenkins.public_ip}"
}

output "app_url" {
  description = "Application URL — use this to access VrdCapital"
  value       = module.dns.app_url
}

output "alb_dns_name" {
  description = "Raw ALB DNS name — use this before a domain is purchased, or as alb_dns_name_override"
  value       = local.alb_dns_name
}

output "route53_name_servers" {
  description = "Point your domain registrar NS records to these after purchasing a domain"
  value       = module.dns.name_servers
}

output "acm_certificate_arn" {
  description = "ACM cert ARN — paste into ingress.yaml annotation when domain is ready"
  value       = module.dns.certificate_arn
}

output "irsa_external_secrets_role_arn" {
  description = "IRSA role ARN for ExternalSecrets — annotate vrdcapital-sa with this"
  value       = module.irsa.external_secrets_role_arn
}

output "irsa_report_s3_role_arn" {
  description = "IRSA role ARN for report-service S3 access — annotate report-service-sa with this"
  value       = module.irsa.report_s3_role_arn
}
