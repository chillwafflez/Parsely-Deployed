#!/usr/bin/env bash
# Build the API image in ACR and roll the running Container App revision.
# Usage: ./scripts/deploy-api.sh [tag]
#   tag — optional image tag. Defaults to a UTC timestamp.

set -euo pipefail

ACR_NAME="docparsingacr"
ACR_LOGIN_SERVER="docparsingacr-eud7hcanetfxe4ae.azurecr.io"
IMAGE_NAME="docparsing-api"
RESOURCE_GROUP="cr-rg-prod-taia"
CONTAINERAPP_NAME="docparsing-api"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TAG="${1:-$(date -u +%Y%m%d-%H%M%S)}"
FULL_IMAGE="$ACR_LOGIN_SERVER/$IMAGE_NAME:$TAG"

az account show > /dev/null 2>&1 || { echo "Not logged in. Run: az login"; exit 1; }

echo "→ Building $FULL_IMAGE in ACR (no local Docker daemon needed)..."
az acr build \
  --registry "$ACR_NAME" \
  --image "$IMAGE_NAME:$TAG" \
  --file "$REPO_ROOT/api/Dockerfile" \
  "$REPO_ROOT/api"

echo "→ Swapping revision on $CONTAINERAPP_NAME to $TAG..."
az containerapp update \
  --name "$CONTAINERAPP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --image "$FULL_IMAGE" \
  --output none

FQDN=$(az containerapp show \
  --name "$CONTAINERAPP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query "properties.configuration.ingress.fqdn" -o tsv)

echo
echo "Done. Image:    $FULL_IMAGE"
echo "      Live URL: https://$FQDN"
