# S3 bucket for reports, exports, and static assets

locals {
  name_prefix = "${var.project}-${var.environment}"
}

resource "aws_s3_bucket" "main" {
  bucket = "${local.name_prefix}-assets-${random_id.suffix.hex}"
  tags   = { Name = "${local.name_prefix}-assets" }
}

resource "random_id" "suffix" {
  byte_length = 4
}

resource "aws_s3_bucket_versioning" "main" {
  bucket = aws_s3_bucket.main.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "main" {
  bucket = aws_s3_bucket.main.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "main" {
  bucket                  = aws_s3_bucket.main.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "main" {
  bucket = aws_s3_bucket.main.id

  rule {
    id     = "reports-expire"
    status = "Enabled"
    filter { prefix = "reports/" }
    expiration { days = 90 }
  }
}
