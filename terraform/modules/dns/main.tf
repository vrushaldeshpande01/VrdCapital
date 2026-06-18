# DNS + TLS module — conditionally creates Route 53 + ACM resources.
# When var.domain is empty (""), all resources in this module are skipped.
# Set var.domain in terraform.tfvars when you buy a domain and run terraform apply.
#
# What gets created when domain is set:
#   1. Route 53 hosted zone for the domain
#   2. ACM certificate with DNS validation (wildcard + apex)
#   3. Route 53 validation records (auto-created, no manual CNAME needed)
#   4. Route 53 A-record alias pointing apex + www → the ALB
#
# The ALB Ingress annotation (certificate-arn) is output so you can patch the
# ingress.yaml or add it to the Kustomize overlay.

locals {
  has_domain = var.domain != ""
}

# ── Route 53 Hosted Zone ──────────────────────────────────────────────────────
resource "aws_route53_zone" "main" {
  count = local.has_domain ? 1 : 0
  name  = var.domain

  tags = {
    Project     = var.project
    Environment = var.environment
  }
}

# ── ACM Certificate (apex + wildcard) ─────────────────────────────────────────
resource "aws_acm_certificate" "main" {
  count             = local.has_domain ? 1 : 0
  domain_name       = var.domain
  validation_method = "DNS"

  subject_alternative_names = [
    "*.${var.domain}",
  ]

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Project     = var.project
    Environment = var.environment
  }
}

# ── DNS Validation Records ────────────────────────────────────────────────────
resource "aws_route53_record" "cert_validation" {
  for_each = local.has_domain ? {
    for dvo in aws_acm_certificate.main[0].domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  } : {}

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = aws_route53_zone.main[0].zone_id
}

resource "aws_acm_certificate_validation" "main" {
  count                   = local.has_domain ? 1 : 0
  certificate_arn         = aws_acm_certificate.main[0].arn
  validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]
}

# ── Route 53 A-record → ALB ──────────────────────────────────────────────────
# Apex (example.com) and www (www.example.com) both point to the ALB.
resource "aws_route53_record" "apex" {
  count   = local.has_domain ? 1 : 0
  zone_id = aws_route53_zone.main[0].zone_id
  name    = var.domain
  type    = "A"

  alias {
    name                   = var.alb_dns_name
    zone_id                = var.alb_zone_id
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "www" {
  count   = local.has_domain ? 1 : 0
  zone_id = aws_route53_zone.main[0].zone_id
  name    = "www.${var.domain}"
  type    = "A"

  alias {
    name                   = var.alb_dns_name
    zone_id                = var.alb_zone_id
    evaluate_target_health = true
  }
}
