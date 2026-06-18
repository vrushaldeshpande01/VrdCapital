variable "project"            { type = string }
variable "environment"        { type = string }
variable "db_username"        { type = string; sensitive = true }
variable "db_password"        { type = string; sensitive = true }
variable "db_host"            { type = string; sensitive = true }
variable "db_name"            { type = string }
variable "redis_host"         { type = string; sensitive = true }
variable "redis_auth_token"   { type = string; sensitive = true }
variable "rabbitmq_user"      { type = string }
variable "rabbitmq_password"  { type = string; sensitive = true }
variable "secret_key"         { type = string; sensitive = true }
variable "zerodha_api_key"    { type = string; sensitive = true }
variable "zerodha_api_secret" { type = string; sensitive = true }
variable "grafana_password"   { type = string; sensitive = true }
