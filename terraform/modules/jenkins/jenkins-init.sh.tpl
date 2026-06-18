#!/bin/bash
set -euo pipefail

# ── System update ─────────────────────────────────────────────────────────────
apt-get update -y
apt-get install -y curl gnupg2 software-properties-common unzip git

# ── Java 17 ──────────────────────────────────────────────────────────────────
apt-get install -y openjdk-17-jdk
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64

# ── Jenkins ──────────────────────────────────────────────────────────────────
curl -fsSL https://pkg.jenkins.io/debian-stable/jenkins.io-2023.key | gpg --dearmor -o /usr/share/keyrings/jenkins-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/jenkins-keyring.gpg] https://pkg.jenkins.io/debian-stable binary/" \
  > /etc/apt/sources.list.d/jenkins.list
apt-get update -y
apt-get install -y jenkins
systemctl enable jenkins
systemctl start jenkins

# ── Docker ────────────────────────────────────────────────────────────────────
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io
usermod -aG docker jenkins
systemctl enable docker
systemctl start docker

# ── AWS CLI v2 ────────────────────────────────────────────────────────────────
curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o /tmp/awscliv2.zip
unzip /tmp/awscliv2.zip -d /tmp
/tmp/aws/install
rm -rf /tmp/aws /tmp/awscliv2.zip

# ── kubectl ───────────────────────────────────────────────────────────────────
KUBECTL_VERSION="v1.29.0"
curl -fsSL "https://dl.k8s.io/release/$${KUBECTL_VERSION}/bin/linux/amd64/kubectl" -o /usr/local/bin/kubectl
chmod +x /usr/local/bin/kubectl

# ── Configure kubeconfig for EKS (so Jenkins can run kubectl) ─────────────────
aws eks update-kubeconfig \
  --name "${eks_cluster_name}" \
  --region "${aws_region}" \
  --kubeconfig /var/lib/jenkins/.kube/config
mkdir -p /var/lib/jenkins/.kube
chown -R jenkins:jenkins /var/lib/jenkins/.kube

# ── ECR login helper ──────────────────────────────────────────────────────────
cat > /etc/profile.d/ecr-login.sh << 'EOF'
alias ecr-login='aws ecr get-login-password --region ${aws_region} | docker login --username AWS --password-stdin ${ecr_registry_url}'
EOF

echo "Jenkins setup complete. Access at http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):8080"
echo "Initial admin password: $(cat /var/lib/jenkins/secrets/initialAdminPassword)"
