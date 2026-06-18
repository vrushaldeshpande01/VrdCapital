#!/bin/bash
# Run this ONCE after EKS cluster is up to install ArgoCD.
# After this, ArgoCD watches the GitOps repo and auto-deploys on every git push.

set -euo pipefail

ARGOCD_VERSION="v2.10.0"
GITHUB_REPO="your-github-username/portfolio-management-platform"  # update this

echo "=== Installing ArgoCD ${ARGOCD_VERSION} ==="

kubectl create namespace argocd --dry-run=client -o yaml | kubectl apply -f -

kubectl apply -n argocd \
  -f "https://raw.githubusercontent.com/argoproj/argo-cd/${ARGOCD_VERSION}/manifests/install.yaml"

echo "=== Waiting for ArgoCD pods to be ready ==="
kubectl wait --for=condition=available deployment/argocd-server \
  -n argocd --timeout=180s

echo "=== Getting initial admin password ==="
echo "ArgoCD admin password:"
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" | base64 -d && echo

echo ""
echo "=== ArgoCD is ready ==="
echo "Port-forward to access UI:  kubectl port-forward svc/argocd-server -n argocd 8080:443"
echo "Login:  argocd login localhost:8080 --username admin --insecure"
echo ""
echo "Next: Apply App of Apps"
echo "  kubectl apply -f deployment/gitops/applications/app-of-apps.yaml"
