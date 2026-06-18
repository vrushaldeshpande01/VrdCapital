output "name_servers" {
  description = "Route 53 name servers — point your registrar's NS records here after domain purchase"
  value       = local.has_domain ? aws_route53_zone.main[0].name_servers : []
}

output "certificate_arn" {
  description = "ACM certificate ARN — add to ingress annotation alb.ingress.kubernetes.io/certificate-arn"
  value       = local.has_domain ? aws_acm_certificate_validation.main[0].certificate_arn : ""
}

output "hosted_zone_id" {
  description = "Route 53 hosted zone ID"
  value       = local.has_domain ? aws_route53_zone.main[0].zone_id : ""
}

output "app_url" {
  description = "Application URL — domain if set, otherwise ALB DNS"
  value       = local.has_domain ? "https://${var.domain}" : "http://${var.alb_dns_name}"
}
