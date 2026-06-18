#!/bin/bash
# Update the image tag in the Kustomize prod overlay.
# Jenkins runs this after each successful ECR push.
# Usage: update-image-tag.sh <service-name> <ecr-registry> <image-tag>

set -euo pipefail

SERVICE_NAME="$1"
ECR_REGISTRY="$2"
IMAGE_TAG="$3"

OVERLAY_DIR="deployment/k8s/overlays/prod"
KUSTOMIZATION="${OVERLAY_DIR}/kustomization.yaml"

echo "=== Updating image tag for ${SERVICE_NAME} to ${IMAGE_TAG} ==="

cd "$(git rev-parse --show-toplevel)"

# kustomize edit set image updates the newTag field in kustomization.yaml
kustomize edit set image \
  "${ECR_REGISTRY}/vrdcapital/${SERVICE_NAME}=${ECR_REGISTRY}/vrdcapital/${SERVICE_NAME}:${IMAGE_TAG}" \
  --kustomization-file "${KUSTOMIZATION}"

echo "Updated ${KUSTOMIZATION}"
grep -A1 "${SERVICE_NAME}" "${KUSTOMIZATION}" | grep newTag
