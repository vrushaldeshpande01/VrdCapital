#!/bin/bash
# EKS Cluster Autoscaler — scales EC2 nodes up/down based on pending pods.
# Run after: terraform apply (EKS cluster must exist).
#
# Usage:
#   AWS_ACCOUNT_ID=123456789012 \
#   CLUSTER_NAME=vrdcapital-prod \
#   AWS_REGION=ap-south-1 \
#   bash deployment/k8s/cluster-autoscaler/install-cluster-autoscaler.sh

set -euo pipefail

AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:?must set AWS_ACCOUNT_ID}"
CLUSTER_NAME="${CLUSTER_NAME:?must set CLUSTER_NAME}"
AWS_REGION="${AWS_REGION:-ap-south-1}"

echo "================================================"
echo " Installing EKS Cluster Autoscaler"
echo " Cluster: ${CLUSTER_NAME}"
echo "================================================"

# ── 1. Create IRSA policy for Cluster Autoscaler ──────────────────────────────
echo ""
echo "[1/3] Creating IAM policy for Cluster Autoscaler..."

aws iam create-policy \
  --policy-name "${CLUSTER_NAME}-cluster-autoscaler" \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": [
          "autoscaling:DescribeAutoScalingGroups",
          "autoscaling:DescribeAutoScalingInstances",
          "autoscaling:DescribeLaunchConfigurations",
          "autoscaling:DescribeScalingActivities",
          "autoscaling:DescribeTags",
          "ec2:DescribeImages",
          "ec2:DescribeInstanceTypes",
          "ec2:DescribeLaunchTemplateVersions",
          "ec2:GetInstanceTypesFromInstanceRequirements",
          "eks:DescribeNodegroup"
        ],
        "Resource": ["*"]
      },
      {
        "Effect": "Allow",
        "Action": [
          "autoscaling:SetDesiredCapacity",
          "autoscaling:TerminateInstanceInAutoScalingGroup"
        ],
        "Resource": ["*"]
      }
    ]
  }' 2>/dev/null || echo "  Policy already exists, skipping."

# ── 2. Create IRSA ServiceAccount ─────────────────────────────────────────────
echo ""
echo "[2/3] Creating IRSA ServiceAccount via eksctl..."

# Get OIDC issuer
OIDC_URL=$(aws eks describe-cluster \
  --name "${CLUSTER_NAME}" \
  --region "${AWS_REGION}" \
  --query "cluster.identity.oidc.issuer" \
  --output text | sed 's|https://||')

POLICY_ARN="arn:aws:iam::${AWS_ACCOUNT_ID}:policy/${CLUSTER_NAME}-cluster-autoscaler"

# Create the IAM role + annotate ServiceAccount
eksctl create iamserviceaccount \
  --cluster="${CLUSTER_NAME}" \
  --namespace=kube-system \
  --name=cluster-autoscaler \
  --attach-policy-arn="${POLICY_ARN}" \
  --override-existing-serviceaccounts \
  --approve \
  --region="${AWS_REGION}" 2>/dev/null || echo "  ServiceAccount may already exist, continuing."

# ── 3. Install Cluster Autoscaler via Helm ────────────────────────────────────
echo ""
echo "[3/3] Installing Cluster Autoscaler Helm chart..."

helm repo add autoscaler https://kubernetes.github.io/autoscaler
helm repo update

helm upgrade --install cluster-autoscaler \
  autoscaler/cluster-autoscaler \
  --namespace kube-system \
  --set autoDiscovery.clusterName="${CLUSTER_NAME}" \
  --set awsRegion="${AWS_REGION}" \
  --set rbac.serviceAccount.create=false \
  --set rbac.serviceAccount.name=cluster-autoscaler \
  --set extraArgs.balance-similar-node-groups=true \
  --set extraArgs.skip-nodes-with-system-pods=false \
  --set extraArgs.scale-down-delay-after-add=5m \
  --set extraArgs.scale-down-unneeded-time=10m \
  --wait --timeout 5m

echo ""
echo "================================================"
echo " Cluster Autoscaler installed!"
echo "================================================"
echo ""
echo "Verify:"
echo "  kubectl get pods -n kube-system -l app.kubernetes.io/name=aws-cluster-autoscaler"
echo "  kubectl logs -n kube-system -l app.kubernetes.io/name=aws-cluster-autoscaler --tail=30"
