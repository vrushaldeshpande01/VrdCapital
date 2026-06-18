#!/bin/bash
# One-time observability stack install on EKS.
# Run after: terraform apply + kubectl configured + ArgoCD installed.
#
# Usage: bash deployment/monitoring/install-monitoring.sh

set -euo pipefail

GRAFANA_PASSWORD="${GRAFANA_PASSWORD:-vrdcapital-grafana-123}"

echo "================================================"
echo " VrdCapital — Observability Stack Install"
echo "================================================"

# ── 1. Add Helm repos ─────────────────────────────────────────────────────────
echo ""
echo "[1/6] Adding Helm repos..."
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana              https://grafana.github.io/helm-charts
helm repo update

# ── 2. Create monitoring namespace ────────────────────────────────────────────
echo ""
echo "[2/6] Creating monitoring namespace..."
kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -

# ── 3. Install kube-prometheus-stack (Prometheus + Grafana + Alertmanager) ────
echo ""
echo "[3/6] Installing kube-prometheus-stack..."
helm upgrade --install kube-prometheus-stack \
  prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --values deployment/monitoring/helm/kube-prometheus-stack-values.yaml \
  --set grafana.adminPassword="${GRAFANA_PASSWORD}" \
  --wait --timeout 10m

# ── 4. Install Loki + Promtail ─────────────────────────────────────────────────
echo ""
echo "[4/6] Installing Loki + Promtail..."
helm upgrade --install loki \
  grafana/loki-stack \
  --namespace monitoring \
  --values deployment/monitoring/helm/loki-stack-values.yaml \
  --wait --timeout 5m

# ── 5. Load VrdCapital dashboard into Grafana ─────────────────────────────────
echo ""
echo "[5/6] Loading VrdCapital Grafana dashboard..."
kubectl create configmap vrdcapital-dashboards \
  --from-file=vrdcapital.json=deployment/monitoring/grafana/dashboards/vrdcapital.json \
  -n monitoring \
  --dry-run=client -o yaml | kubectl apply -f -

# ── 6. Install OpenTelemetry Operator + Collector ─────────────────────────────
echo ""
echo "[6/6] Installing OpenTelemetry Operator..."
kubectl apply -f https://github.com/open-telemetry/opentelemetry-operator/releases/latest/download/opentelemetry-operator.yaml

echo "Waiting for OTel operator to be ready..."
kubectl wait --for=condition=available deployment/opentelemetry-operator-controller-manager \
  -n opentelemetry-operator-system --timeout=120s

echo "Applying OTel Collector..."
kubectl apply -f deployment/monitoring/otel/otel-collector.yaml

# ── 7. Apply alert rules ──────────────────────────────────────────────────────
echo ""
echo "Applying alert rules..."
kubectl apply -f deployment/monitoring/alerts/vrdcapital-alerts.yaml

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "================================================"
echo " Observability stack installed successfully!"
echo "================================================"
echo ""
echo "Access Grafana:"
echo "  kubectl port-forward svc/kube-prometheus-stack-grafana 3000:80 -n monitoring"
echo "  Open: http://localhost:3000"
echo "  User: admin / Password: ${GRAFANA_PASSWORD}"
echo ""
echo "Access Prometheus:"
echo "  kubectl port-forward svc/kube-prometheus-stack-prometheus 9090:9090 -n monitoring"
echo "  Open: http://localhost:9090"
echo ""
echo "Access Alertmanager:"
echo "  kubectl port-forward svc/kube-prometheus-stack-alertmanager 9093:9093 -n monitoring"
echo "  Open: http://localhost:9093"
