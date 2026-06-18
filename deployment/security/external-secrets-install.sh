#!/bin/bash
# Install ExternalSecrets Operator on EKS.
# Run once after: terraform apply + kubectl configured for the cluster.
#
# Usage:
#   AWS_ACCOUNT_ID=123456789012 \
#   AWS_REGION=ap-south-1 \
#   bash deployment/security/external-secrets-install.sh

set -euo pipefail

EXTERNAL_SECRETS_VERSION="${EXTERNAL_SECRETS_VERSION:-0.9.13}"
AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:?must set AWS_ACCOUNT_ID}"
AWS_REGION="${AWS_REGION:-ap-south-1}"
PROJECT="${PROJECT:-vrdcapital}"
ENVIRONMENT="${ENVIRONMENT:-prod}"

echo "================================================"
echo " VrdCapital — ExternalSecrets + IRSA Setup"
echo "================================================"

# ── 1. Install ExternalSecrets operator via Helm ──────────────────────────────
echo ""
echo "[1/5] Adding ExternalSecrets Helm repo..."
helm repo add external-secrets https://charts.external-secrets.io
helm repo update

echo "[2/5] Installing ExternalSecrets operator (v${EXTERNAL_SECRETS_VERSION})..."
helm upgrade --install external-secrets \
  external-secrets/external-secrets \
  --namespace external-secrets \
  --create-namespace \
  --version "${EXTERNAL_SECRETS_VERSION}" \
  --set installCRDs=true \
  --wait --timeout 5m

# ── 2. Patch the vrdcapital ServiceAccount with the IRSA role ARN ─────────────
echo ""
echo "[3/5] Annotating vrdcapital-sa ServiceAccount with IRSA role..."
ROLE_ARN="arn:aws:iam::${AWS_ACCOUNT_ID}:role/${PROJECT}-${ENVIRONMENT}-secrets-read"

kubectl annotate serviceaccount vrdcapital-sa \
  --namespace vrdcapital \
  eks.amazonaws.com/role-arn="${ROLE_ARN}" \
  --overwrite

echo "      ServiceAccount vrdcapital-sa annotated with: ${ROLE_ARN}"

# ── 3. Apply SecretStore + ExternalSecret manifests ───────────────────────────
echo ""
echo "[4/5] Applying SecretStore and ExternalSecret..."
kubectl apply -f deployment/k8s/base/external-secret.yaml

# ── 4. Verify secret sync ─────────────────────────────────────────────────────
echo ""
echo "[5/5] Waiting for ExternalSecret to sync..."
sleep 10

STATUS=$(kubectl get externalsecret vrdcapital-app-secrets \
  -n vrdcapital \
  -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' 2>/dev/null || echo "Unknown")

if [ "${STATUS}" = "True" ]; then
  echo "  ExternalSecret status: Ready ✓"
else
  echo "  ExternalSecret status: ${STATUS}"
  echo "  Check with: kubectl describe externalsecret vrdcapital-app-secrets -n vrdcapital"
fi

echo ""
echo "  Verify the synced secret:"
echo "  kubectl get secret vrdcapital-secrets -n vrdcapital"
echo ""

# ── Done ──────────────────────────────────────────────────────────────────────
echo "================================================"
echo " ExternalSecrets setup complete!"
echo "================================================"
echo ""
echo "Useful commands:"
echo "  kubectl get secretstore   -n vrdcapital"
echo "  kubectl get externalsecret -n vrdcapital"
echo "  kubectl describe externalsecret vrdcapital-app-secrets -n vrdcapital"
