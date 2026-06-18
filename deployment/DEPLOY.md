# VrdCapital — Full Deployment Runbook (Phase 2 / EKS)

Run these steps in order. Each step depends on the previous.

---

## Prerequisites

Install on your local machine:
- AWS CLI v2 (`aws --version`)
- Terraform >= 1.6 (`terraform --version`)
- kubectl (`kubectl version --client`)
- Helm 3 (`helm version`)
- git

Configure AWS credentials:
```bash
aws configure
# Region: ap-south-1
# Output: json
```

---

## Step 1 — Bootstrap Terraform Remote State

Run once, before anything else. Creates the S3 bucket and DynamoDB table for Terraform state.

```bash
cd terraform
bash bootstrap.sh
```

---

## Step 2 — Configure Variables

```bash
cd terraform/environments/prod
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars — fill in all CHANGE_ME values
# Leave domain="" and alb_dns_name_override="" for now
```

---

## Step 3 — Track 1: Provision AWS Infrastructure

```bash
cd terraform/environments/prod
terraform init
terraform plan -out=tfplan
terraform apply tfplan
```

Note the outputs — you'll need these later:
```bash
terraform output eks_cluster_name
terraform output jenkins_public_ip
terraform output ecr_registry_url
```

Configure kubectl for the EKS cluster:
```bash
aws eks update-kubeconfig \
  --name $(terraform output -raw eks_cluster_name) \
  --region ap-south-1
kubectl get nodes   # verify nodes are Ready
```

---

## Step 4 — Install ALB Ingress Controller

Required before applying Kubernetes manifests — the Ingress resource needs this controller.

```bash
# Install AWS Load Balancer Controller via Helm
helm repo add eks https://aws.github.io/eks-charts
helm repo update

helm upgrade --install aws-load-balancer-controller \
  eks/aws-load-balancer-controller \
  --namespace kube-system \
  --set clusterName=$(terraform -chdir=terraform/environments/prod output -raw eks_cluster_name) \
  --set serviceAccount.create=true \
  --set region=ap-south-1 \
  --wait
```

---

## Step 5 — Track 5: Security Setup (ExternalSecrets + NetworkPolicies)

```bash
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export AWS_REGION=ap-south-1

bash deployment/security/install-security.sh
```

This installs ExternalSecrets, patches the ServiceAccount with the IRSA role, applies
Pod Security Standards, NetworkPolicies, and the Trivy scanner CronJob.

---

## Step 6 — Track 2: Deploy Kubernetes Manifests

Replace `ACCOUNT_ID` in the overlay kustomization with your real AWS account ID:
```bash
sed -i "s/ACCOUNT_ID/${AWS_ACCOUNT_ID}/g" \
  deployment/k8s/overlays/prod/kustomization.yaml
```

Apply the full stack:
```bash
kubectl apply -k deployment/k8s/overlays/prod
kubectl rollout status deployment -n vrdcapital --timeout=300s
kubectl get pods -n vrdcapital
```

Get your ALB URL (will take ~2 minutes to provision):
```bash
kubectl get ingress vrdcapital-ingress -n vrdcapital \
  -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'
```

The app is now reachable at `http://<alb-dns-name>`.

---

## Step 7 — Track 4: Install Observability Stack

```bash
bash deployment/monitoring/install-monitoring.sh
```

Access Grafana:
```bash
kubectl port-forward svc/kube-prometheus-stack-grafana 3000:80 -n monitoring
# Open: http://localhost:3000  (admin / grafana_password from tfvars)
```

---

## Step 8 — Track 3: Configure Jenkins + ArgoCD

**Jenkins:**
1. Open `http://<jenkins-ip>:8080`
2. Follow `jenkins/JENKINS-SETUP.md` to configure credentials and pipelines

**ArgoCD:**
```bash
bash deployment/gitops/argocd-install.sh
kubectl apply -f deployment/gitops/applications/app-of-apps.yaml
```

---

## Step 9 — Zerodha Daily Auth

Zerodha access tokens expire every 24 hours. After deploy:

```bash
# Get login URL from broker-service
curl http://<alb-dns>/api/v1/broker/zerodha/login

# Complete login in browser, copy request_token from redirect URL
# Then exchange:
curl -X POST http://<alb-dns>/api/v1/broker/zerodha/callback \
  -H "Content-Type: application/json" \
  -d '{"request_token": "<token_from_redirect>"}'
```

The `ZerodhaTokenExpired` Prometheus alert fires if this step is missed.

---

## Step 10 (When You Buy a Domain) — Track 6: Enable DNS + TLS

1. Edit `terraform/environments/prod/terraform.tfvars`:
   ```
   domain                = "vrdcapital.in"
   alb_dns_name_override = "<alb-dns-from-step-6>"
   ```

2. Apply Terraform:
   ```bash
   cd terraform/environments/prod
   terraform apply
   ```

3. Point your registrar's nameservers to the Route 53 NS records:
   ```bash
   terraform output route53_name_servers
   ```

4. Wait for DNS propagation (~5 minutes for Route 53, up to 48h at registrar).

5. Get the ACM certificate ARN:
   ```bash
   terraform output acm_certificate_arn
   ```

6. Edit `deployment/k8s/overlays/prod/patches/ingress-tls.yaml`:
   - Replace `CERT_ARN_HERE` with the ACM ARN
   - Replace `DOMAIN_HERE` with `vrdcapital.in`

7. Uncomment the ingress-tls patch in `deployment/k8s/overlays/prod/kustomization.yaml`

8. Apply:
   ```bash
   kubectl apply -k deployment/k8s/overlays/prod
   ```

App is now live at `https://vrdcapital.in` with auto-renewing TLS.

---

## Useful Diagnostic Commands

```bash
# Pod status
kubectl get pods -n vrdcapital

# Pod logs
kubectl logs -l app=broker-service -n vrdcapital --tail=50

# ExternalSecret sync status
kubectl describe externalsecret vrdcapital-app-secrets -n vrdcapital

# NetworkPolicy list
kubectl get networkpolicy -n vrdcapital

# HPA status
kubectl get hpa -n vrdcapital

# ALB ingress
kubectl describe ingress vrdcapital-ingress -n vrdcapital

# ArgoCD app status
kubectl get application -n argocd

# Trivy scan (manual trigger)
kubectl create job trivy-manual --from=cronjob/trivy-ecr-scan -n vrdcapital
kubectl logs job/trivy-manual -n vrdcapital -f
```
