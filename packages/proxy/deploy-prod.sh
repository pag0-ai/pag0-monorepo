#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

APP_NAME="pag0-monorepo"
ENV_FILE="$SCRIPT_DIR/.env.production"

if [ ! -f "$ENV_FILE" ]; then
  echo "Error: $ENV_FILE not found"
  exit 1
fi

echo "==> Setting Fly.io secrets from $ENV_FILE"
SECRETS_ARGS=()
while IFS= read -r line || [[ -n "$line" ]]; do
  [[ -z "$line" || "$line" =~ ^# ]] && continue
  key="${line%%=*}"
  value="${line#*=}"
  echo "  $key"
  SECRETS_ARGS+=("${key}=${value}")
done < "$ENV_FILE"

# Add dashboard domain to CORS
CORS="http://localhost:3001,https://pag0-monorepo.fly.dev,https://pag0-demo-dashboard.vercel.app"
echo "  CORS_ORIGINS (override)"
SECRETS_ARGS+=("CORS_ORIGINS=${CORS}")

fly secrets set "${SECRETS_ARGS[@]}" -a "$APP_NAME"

echo ""
echo "==> Deploying to Fly.io"
cd "$REPO_ROOT" && fly deploy -a "$APP_NAME"

echo ""
echo "==> Done! Production: https://${APP_NAME}.fly.dev"
