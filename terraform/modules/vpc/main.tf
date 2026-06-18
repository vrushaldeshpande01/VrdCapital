# VPC with 3 AZs, public + private subnets, NAT Gateway
# Public subnets: ALB, Jenkins EC2, NAT
# Private subnets: EKS nodes, RDS, ElastiCache

locals {
  azs             = ["${var.aws_region}a", "${var.aws_region}b", "${var.aws_region}c"]
  public_cidrs    = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  private_cidrs   = ["10.0.10.0/24", "10.0.11.0/24", "10.0.12.0/24"]
  name_prefix     = "${var.project}-${var.environment}"
}

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = { Name = "${local.name_prefix}-vpc" }
}

# ── Internet Gateway ────────────────────────────────────────────────────────

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "${local.name_prefix}-igw" }
}

# ── Public Subnets ──────────────────────────────────────────────────────────

resource "aws_subnet" "public" {
  count                   = 3
  vpc_id                  = aws_vpc.main.id
  cidr_block              = local.public_cidrs[count.index]
  availability_zone       = local.azs[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name                                                        = "${local.name_prefix}-public-${count.index + 1}"
    "kubernetes.io/role/elb"                                    = "1"
    "kubernetes.io/cluster/${var.project}-${var.environment}"   = "shared"
  }
}

# ── Private Subnets ─────────────────────────────────────────────────────────

resource "aws_subnet" "private" {
  count             = 3
  vpc_id            = aws_vpc.main.id
  cidr_block        = local.private_cidrs[count.index]
  availability_zone = local.azs[count.index]

  tags = {
    Name                                                        = "${local.name_prefix}-private-${count.index + 1}"
    "kubernetes.io/role/internal-elb"                           = "1"
    "kubernetes.io/cluster/${var.project}-${var.environment}"   = "shared"
  }
}

# ── NAT Gateway (single, in first public subnet) ────────────────────────────
# For production HA use one per AZ. Single is fine for learning/demo.

resource "aws_eip" "nat" {
  domain = "vpc"
  tags   = { Name = "${local.name_prefix}-nat-eip" }
}

resource "aws_nat_gateway" "main" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public[0].id
  depends_on    = [aws_internet_gateway.main]
  tags          = { Name = "${local.name_prefix}-nat" }
}

# ── Route Tables ─────────────────────────────────────────────────────────────

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "${local.name_prefix}-public-rt" }

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }
}

resource "aws_route_table_association" "public" {
  count          = 3
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "${local.name_prefix}-private-rt" }

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main.id
  }
}

resource "aws_route_table_association" "private" {
  count          = 3
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}
