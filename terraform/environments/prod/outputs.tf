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
