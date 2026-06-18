# Jenkins EC2 — t3.medium, Ubuntu 22.04, public subnet
# Jenkins is pre-installed via user_data on first boot

locals {
  name_prefix = "${var.project}-${var.environment}"
}

data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

resource "aws_security_group" "jenkins" {
  name        = "${local.name_prefix}-jenkins-sg"
  description = "Jenkins EC2 security group"
  vpc_id      = var.vpc_id

  ingress {
    description = "Jenkins web UI"
    from_port   = 8080
    to_port     = 8080
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "SSH access"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${local.name_prefix}-jenkins-sg" }
}

resource "aws_instance" "jenkins" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.instance_type
  subnet_id              = var.public_subnet_id
  vpc_security_group_ids = [aws_security_group.jenkins.id]
  key_name               = var.key_name
  iam_instance_profile   = "${local.name_prefix}-jenkins-profile"

  root_block_device {
    volume_size = 30
    volume_type = "gp3"
    encrypted   = true
  }

  user_data = base64encode(templatefile("${path.module}/jenkins-init.sh.tpl", {
    aws_region       = var.aws_region
    ecr_registry_url = var.ecr_registry_url
    eks_cluster_name = var.eks_cluster_name
  }))

  tags = { Name = "${local.name_prefix}-jenkins" }
}

resource "aws_eip" "jenkins" {
  instance = aws_instance.jenkins.id
  domain   = "vpc"
  tags     = { Name = "${local.name_prefix}-jenkins-eip" }
}
