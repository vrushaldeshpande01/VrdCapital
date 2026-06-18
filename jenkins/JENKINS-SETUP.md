# Jenkins Setup Guide

## 1. Access Jenkins
After `terraform apply`, Jenkins EC2 boots with Jenkins pre-installed.

```bash
# Get public IP from Terraform output
terraform -chdir=terraform/environments/prod output jenkins_public_ip

# SSH in
ssh -i ~/.ssh/vrdcapital-jenkins.pem ubuntu@<PUBLIC_IP>

# Get initial admin password
sudo cat /var/lib/jenkins/secrets/initialAdminPassword
```

Open `http://<PUBLIC_IP>:8080` and complete setup wizard.

---

## 2. Install Required Jenkins Plugins
Manage Jenkins → Plugins → Install:
- **Pipeline** (usually pre-installed)
- **Git**
- **GitHub Integration**
- **Docker Pipeline**
- **Credentials Binding**
- **AWS Steps**

---

## 3. Configure Credentials
Manage Jenkins → Credentials → System → Global → Add Credential:

| ID | Type | Value |
|---|---|---|
| `github-credentials` | Username + Password | GitHub username + Personal Access Token |
| `argocd-token` | Secret Text | ArgoCD API token (get after ArgoCD install) |

---

## 4. Configure Environment Variables
Manage Jenkins → System → Global Properties → Environment Variables:

| Name | Value |
|---|---|
| `AWS_ACCOUNT_ID` | Your 12-digit AWS account ID |
| `AWS_REGION` | `ap-south-1` |
| `GITHUB_REPO` | `your-username/portfolio-management-platform` |
| `ARGOCD_SERVER` | ArgoCD server address (after install) |
| `ARGOCD_TOKEN` | ArgoCD API token |

---

## 5. Create Pipeline Job
New Item → Pipeline → Name: `vrdcapital-main`

Pipeline config:
- **Definition:** Pipeline script from SCM
- **SCM:** Git
- **Repository URL:** `https://github.com/your-username/portfolio-management-platform.git`
- **Credentials:** `github-credentials`
- **Branch:** `*/main`
- **Script Path:** `Jenkinsfile`

---

## 6. Configure GitHub Webhook
In your GitHub repo → Settings → Webhooks → Add webhook:
- **Payload URL:** `http://<JENKINS_IP>:8080/github-webhook/`
- **Content type:** `application/json`
- **Events:** Just the push event

---

## 7. Install ArgoCD CLI on Jenkins EC2
```bash
sudo ssh -i ~/.ssh/vrdcapital-jenkins.pem ubuntu@<JENKINS_IP>

VERSION="v2.10.0"
curl -sSL -o /usr/local/bin/argocd \
  https://github.com/argoproj/argo-cd/releases/download/${VERSION}/argocd-linux-amd64
chmod +x /usr/local/bin/argocd
```

---

## 8. Install kustomize on Jenkins EC2
```bash
curl -s "https://raw.githubusercontent.com/kubernetes-sigs/kustomize/master/hack/install_kustomize.sh" | bash
sudo mv kustomize /usr/local/bin/
```

---

## Full CI/CD Flow (after setup)
```
Developer pushes to main
  → GitHub webhook triggers Jenkins
    → Jenkins detects changed services
      → Docker build + ECR push (parallel per service)
        → kustomize edit set image (updates tag in overlay)
          → git commit + push [skip ci]
            → ArgoCD detects diff in GitOps repo
              → ArgoCD syncs → kubectl apply → EKS rolling update
                → Jenkins verifies rollout status
```
