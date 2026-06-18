output "external_secrets_role_arn" {
  description = "ARN of the IRSA role for ExternalSecrets operator (annotate vrdcapital-sa)"
  value       = aws_iam_role.external_secrets.arn
}

output "report_s3_role_arn" {
  description = "ARN of the IRSA role for report-service S3 access (annotate report-service-sa)"
  value       = aws_iam_role.report_s3.arn
}
