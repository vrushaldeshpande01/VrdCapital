# IRSA (IAM Roles for Service Accounts)
# Creates two IAM roles that Kubernetes ServiceAccounts can assume via OIDC federation:
#   1. vrdcapital-prod-secrets-read  — ExternalSecrets operator reads Secrets Manager
#   2. vrdcapital-prod-s3-reports    — report-service writes to the S3 reports bucket

locals {
  oidc_provider_id = replace(var.oidc_provider_url, "https://", "")
}

# ── 1. ExternalSecrets role ────────────────────────────────────────────────────
# Assumed by the ServiceAccount "vrdcapital-sa" in namespace "vrdcapital"
resource "aws_iam_role" "external_secrets" {
  name = "${var.project}-${var.environment}-secrets-read"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = "arn:aws:iam::${var.aws_account_id}:oidc-provider/${local.oidc_provider_id}"
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "${local.oidc_provider_id}:sub" = "system:serviceaccount:vrdcapital:vrdcapital-sa"
            "${local.oidc_provider_id}:aud" = "sts.amazonaws.com"
          }
        }
      }
    ]
  })

  tags = {
    Project     = var.project
    Environment = var.environment
    Purpose     = "external-secrets-irsa"
  }
}

resource "aws_iam_policy" "secrets_read" {
  name        = "${var.project}-${var.environment}-secrets-read-policy"
  description = "Allow ExternalSecrets operator to read Secrets Manager and SSM"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "SecretsManagerRead"
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret",
          "secretsmanager:ListSecretVersionIds"
        ]
        Resource = [
          "arn:aws:secretsmanager:${var.aws_region}:${var.aws_account_id}:secret:${var.project}/${var.environment}/*"
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "external_secrets" {
  role       = aws_iam_role.external_secrets.name
  policy_arn = aws_iam_policy.secrets_read.arn
}

# ── 2. Report-service S3 role ──────────────────────────────────────────────────
# Assumed by ServiceAccount "report-service-sa" in namespace "vrdcapital"
resource "aws_iam_role" "report_s3" {
  name = "${var.project}-${var.environment}-report-s3"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = "arn:aws:iam::${var.aws_account_id}:oidc-provider/${local.oidc_provider_id}"
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "${local.oidc_provider_id}:sub" = "system:serviceaccount:vrdcapital:report-service-sa"
            "${local.oidc_provider_id}:aud" = "sts.amazonaws.com"
          }
        }
      }
    ]
  })

  tags = {
    Project     = var.project
    Environment = var.environment
    Purpose     = "report-service-irsa"
  }
}

resource "aws_iam_policy" "report_s3" {
  name        = "${var.project}-${var.environment}-report-s3-policy"
  description = "Allow report-service to read/write reports/ prefix in S3"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ReportsBucketAccess"
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          "arn:aws:s3:::${var.reports_bucket_name}",
          "arn:aws:s3:::${var.reports_bucket_name}/reports/*"
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "report_s3" {
  role       = aws_iam_role.report_s3.name
  policy_arn = aws_iam_policy.report_s3.arn
}
