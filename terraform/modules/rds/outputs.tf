output "endpoint" {
  description = "RDS PostgreSQL endpoint (host:port)"
  value       = aws_db_instance.main.endpoint
}

output "security_group_id" {
  description = "RDS security group ID"
  value       = aws_security_group.rds.id
}
