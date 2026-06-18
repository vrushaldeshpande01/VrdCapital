# One ECR repository per microservice

resource "aws_ecr_repository" "services" {
  for_each = toset(var.services)

  name                 = "${var.project}/${each.value}"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = { Name = "${var.project}/${each.value}" }
}

# Lifecycle policy: keep last 10 images, delete untagged after 1 day
resource "aws_ecr_lifecycle_policy" "services" {
  for_each   = aws_ecr_repository.services
  repository = each.value.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Remove untagged images after 1 day"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 1
        }
        action = { type = "expire" }
      },
      {
        rulePriority = 2
        description  = "Keep only last 10 tagged images"
        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["v", "main", "prod"]
          countType     = "imageCountMoreThan"
          countNumber   = 10
        }
        action = { type = "expire" }
      },
    ]
  })
}
