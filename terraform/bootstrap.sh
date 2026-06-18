#!/bin/bash
# Run this ONCE before the first terraform apply to create the S3 backend bucket
# and DynamoDB lock table. Everything else is managed by Terraform itself.

set -euo pipefail

REGION="ap-south-1"
BUCKET="vrdcapital-terraform-state"
TABLE="vrdcapital-terraform-locks"

echo "=== Creating Terraform state backend ==="

# S3 bucket for state
aws s3api create-bucket \
  --bucket "$BUCKET" \
  --region "$REGION" \
  --create-bucket-configuration LocationConstraint="$REGION"

aws s3api put-bucket-versioning \
  --bucket "$BUCKET" \
  --versioning-configuration Status=Enabled

aws s3api put-bucket-encryption \
  --bucket "$BUCKET" \
  --server-side-encryption-configuration '{
    "Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]
  }'

aws s3api put-public-access-block \
  --bucket "$BUCKET" \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

# DynamoDB table for state locking
aws dynamodb create-table \
  --table-name "$TABLE" \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region "$REGION"

echo ""
echo "=== Backend ready ==="
echo "S3 bucket : $BUCKET"
echo "DynamoDB  : $TABLE"
echo ""
echo "Next steps:"
echo "  1. cd terraform/environments/prod"
echo "  2. cp terraform.tfvars.example terraform.tfvars"
echo "  3. Fill in terraform.tfvars with real values"
echo "  4. terraform init"
echo "  5. terraform plan"
echo "  6. terraform apply"
