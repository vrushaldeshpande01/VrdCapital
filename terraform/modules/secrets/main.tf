# AWS Secrets Manager — stores all app secrets
# ExternalSecrets operator in EKS syncs these into K8s Secrets

locals {
  name_prefix = "${var.project}/${var.environment}"
}

resource "aws_secretsmanager_secret" "app" {
  name                    = "${local.name_prefix}/app"
  description             = "VrdCapital application secrets"
  recovery_window_in_days = 7
  tags                    = { Name = "${var.project}-${var.environment}-app-secrets" }
}

resource "aws_secretsmanager_secret_version" "app" {
  secret_id = aws_secretsmanager_secret.app.id

  secret_string = jsonencode({
    # PostgreSQL — points to RDS endpoint
    POSTGRES_USER     = var.db_username
    POSTGRES_PASSWORD = var.db_password
    POSTGRES_DB       = var.db_name
    DATABASE_URL      = "postgresql+asyncpg://${var.db_username}:${var.db_password}@${var.db_host}/${var.db_name}"

    # Redis — points to ElastiCache endpoint (TLS, auth token)
    REDIS_PASSWORD = var.redis_auth_token
    REDIS_URL      = "rediss://:${var.redis_auth_token}@${var.redis_host}:6379/0"

    # RabbitMQ — in-cluster service DNS
    RABBITMQ_USER     = var.rabbitmq_user
    RABBITMQ_PASSWORD = var.rabbitmq_password
    RABBITMQ_URL      = "amqp://${var.rabbitmq_user}:${var.rabbitmq_password}@rabbitmq:5672/"

    # App
    SECRET_KEY               = var.secret_key
    ACCESS_TOKEN_EXPIRE_MINUTES = "30"
    REFRESH_TOKEN_EXPIRE_DAYS   = "7"
    ENVIRONMENT              = var.environment
    LOG_LEVEL                = "INFO"

    # Zerodha
    ZERODHA_API_KEY    = var.zerodha_api_key
    ZERODHA_API_SECRET = var.zerodha_api_secret

    # Grafana
    GRAFANA_PASSWORD = var.grafana_password
  })
}
