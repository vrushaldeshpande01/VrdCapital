#!/bin/bash
# Track 5 Security setup — run after terraform apply + monitoring stack install.
#
# What this does:
#   1. Installs ExternalSecrets operator + configures IRSA
#   2. Applies Pod Security Standards label to vrdcapital namespace
#   3. Applies granular NetworkPolicies
#   4. Deploys Trivy ECR scanner CronJob
#   5. Prints a post-install security checklist
#
# Usage:
#   AWS_ACCOUNT_ID=123456789012 \
#   AWS_REGION=ap-south-1 \
#   bash deployment/security/install-security.sh

set -euo pipefail

AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:?must set AWS_ACCOUNT_ID}"
AWS_REGION="${AWS_REGION:-ap-south-1}"
PROJECT="${PROJECT:-vrdcapital}"
ENVIRONMENT="${ENVIRONMENT:-prod}"

echo "================================================"
echo " VrdCapital — Track 5: Security Setup"
echo "================================================"

# ── 1. ExternalSecrets operator + IRSA ───────────────────────────────────────
echo ""
echo "[1/4] Installing ExternalSecrets operator + IRSA..."
bash deployment/security/external-secrets-install.sh

# ── 2. Pod Security Standards ─────────────────────────────────────────────────
echo ""
echo "[2/4] Applying Pod Security Standards (restricted) to vrdcapital namespace..."
kubectl apply -f deployment/security/pod-security.yaml

# ── 3. NetworkPolicies ────────────────────────────────────────────────────────
echo ""
echo "[3/4] Applying granular NetworkPolicies..."
kubectl apply -f deployment/k8s/base/network-policies.yaml

echo ""
echo "  Verifying NetworkPolicies:"
kubectl get networkpolicy -n vrdcapital

# ── 4. Trivy CronJob — patch ACCOUNT_ID ──────────────────────────────────────
echo ""
echo "[4/4] Deploying Trivy ECR scanner CronJob..."
sed "s/ACCOUNT_ID/${AWS_ACCOUNT_ID}/g" deployment/security/trivy-scan.yaml \
  | kubectl apply -f -

echo ""
echo "  Trivy CronJob scheduled. Runs daily at 02:00 IST."
echo "  To trigger manually:"
echo "  kubectl create job trivy-manual --from=cronjob/trivy-ecr-scan -n vrdcapital"

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "================================================"
echo " Track 5 Security Setup Complete!"
echo "================================================"
echo ""
echo "Post-install checklist:"
echo ""
echo "  [ ] Verify ExternalSecret synced:"
echo "      kubectl get secret vrdcapital-secrets -n vrdcapital"
echo ""
echo "  [ ] Confirm pods still start (PSS restricted + NetworkPolicies applied):"
echo "      kubectl get pods -n vrdcapital"
echo ""
echo "  [ ] Confirm inter-service calls work:"
echo "      kubectl logs -l app=order-service -n vrdcapital --tail=20"
echo ""
echo "  [ ] Zerodha daily re-auth (Zerodha tokens expire every 24h):"
echo "      POST /api/v1/broker/zerodha/login  (with request_token from Zerodha kite.trade)"
echo "      The ZerodhaTokenExpired Prometheus alert fires on 401 responses from broker-service."
echo ""
echo "  [ ] Rotate app secrets monthly:"
echo "      aws secretsmanager rotate-secret --secret-id ${PROJECT}/${ENVIRONMENT}/app"
echo ""
echo "  [ ] Review Trivy scan results:"
echo "      kubectl logs job/trivy-manual -n vrdcapital 2>/dev/null || echo 'Run manual job first'"
echo ""
echo "  [ ] Check git log --diff-filter=A -- '*.env' '*.tfvars' for any accidental secret commits"
