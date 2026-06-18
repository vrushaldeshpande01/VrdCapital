#!/bin/bash
# Build a Docker image and push to ECR.
# Usage: build-push.sh <service-name> <ecr-registry> <image-tag>

set -euo pipefail

SERVICE_NAME="$1"
ECR_REGISTRY="$2"
IMAGE_TAG="$3"

# Map service name to Dockerfile location
case "$SERVICE_NAME" in
  auth-service|client-service|portfolio-service|broker-service|order-service|notification-service|report-service)
    CONTEXT="services/${SERVICE_NAME}"
    ;;
  frontend)
    CONTEXT="frontend"
    ;;
  *)
    echo "ERROR: Unknown service '${SERVICE_NAME}'"
    exit 1
    ;;
esac

FULL_IMAGE="${ECR_REGISTRY}/vrdcapital/${SERVICE_NAME}"

echo "=== Building ${SERVICE_NAME} ==="
echo "Context   : ${CONTEXT}"
echo "Image     : ${FULL_IMAGE}:${IMAGE_TAG}"

docker build \
  --file "${CONTEXT}/Dockerfile" \
  --tag "${FULL_IMAGE}:${IMAGE_TAG}" \
  --tag "${FULL_IMAGE}:latest" \
  --build-arg BUILDKIT_INLINE_CACHE=1 \
  --cache-from "${FULL_IMAGE}:latest" \
  "${CONTEXT}"

echo "=== Pushing ${SERVICE_NAME} ==="
docker push "${FULL_IMAGE}:${IMAGE_TAG}"
docker push "${FULL_IMAGE}:latest"

echo "=== Done: ${FULL_IMAGE}:${IMAGE_TAG} ==="
