#!/usr/bin/env bash
# Drop and recreate docparsing-db. Next ACA cold start re-runs Migrate() on
# the empty schema. Blob container 'uploads' is NOT touched — pass --blobs
# to also clear uploaded files.
# Usage: ./scripts/wipe-db.sh [--blobs] [--yes]

set -euo pipefail

RESOURCE_GROUP="cr-rg-prod-taia"
SQL_SERVER="docparsing-sql"
SQL_DB="docparsing-db"
STORAGE_ACCOUNT="docparsingstoragetaia"
BLOB_CONTAINER="uploads"
CONTAINERAPP_NAME="docparsing-api"

WIPE_BLOBS=0
SKIP_CONFIRM=0
for arg in "$@"; do
  case "$arg" in
    --blobs) WIPE_BLOBS=1 ;;
    --yes|-y) SKIP_CONFIRM=1 ;;
    *) echo "Unknown arg: $arg"; exit 1 ;;
  esac
done

az account show > /dev/null 2>&1 || { echo "Not logged in. Run: az login"; exit 1; }

echo "About to DESTROY:"
echo "  Database: $SQL_SERVER/$SQL_DB"
[ "$WIPE_BLOBS" -eq 1 ] && echo "  Blobs:    $STORAGE_ACCOUNT/$BLOB_CONTAINER (all files)"
echo

if [ "$SKIP_CONFIRM" -eq 0 ]; then
  read -r -p "Type 'wipe' to confirm: " CONFIRM
  [ "$CONFIRM" = "wipe" ] || { echo "Aborted."; exit 1; }
fi

echo "→ Deleting database $SQL_DB..."
az sql db delete \
  --name "$SQL_DB" \
  --server "$SQL_SERVER" \
  --resource-group "$RESOURCE_GROUP" \
  --yes \
  --output none

echo "→ Recreating database $SQL_DB (GP Serverless, Gen5, 1 vCore, 60-min auto-pause)..."
az sql db create \
  --name "$SQL_DB" \
  --server "$SQL_SERVER" \
  --resource-group "$RESOURCE_GROUP" \
  --edition GeneralPurpose \
  --compute-model Serverless \
  --family Gen5 \
  --capacity 1 \
  --auto-pause-delay 60 \
  --output none

if [ "$WIPE_BLOBS" -eq 1 ]; then
  echo "→ Clearing blob container $BLOB_CONTAINER..."
  az storage blob delete-batch \
    --account-name "$STORAGE_ACCOUNT" \
    --source "$BLOB_CONTAINER" \
    --auth-mode login \
    --output none
fi

FQDN=$(az containerapp show \
  --name "$CONTAINERAPP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query "properties.configuration.ingress.fqdn" -o tsv)

echo "→ Pinging https://$FQDN/api/documents to trigger cold start (runs Migrate())..."
curl -sSf "https://$FQDN/api/documents" > /dev/null && echo "  Migration applied. Tables are empty."

echo
echo "Done."
