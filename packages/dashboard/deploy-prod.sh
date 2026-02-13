#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

DOMAIN="pag0-demo-dashboard.vercel.app"
ENV_FILE=".env.production"

if [ ! -f "$ENV_FILE" ]; then
  echo "Error: $ENV_FILE not found"
  exit 1
fi

echo "==> Setting Vercel env vars from $ENV_FILE"
while IFS= read -r line || [[ -n "$line" ]]; do
  # Skip comments and empty lines
  [[ -z "$line" || "$line" =~ ^# ]] && continue
  key="${line%%=*}"
  value="${line#*=}"
  # Remove surrounding quotes from value
  value="${value%\"}"
  value="${value#\"}"
  echo "  $key"
  printf '%s' "$value" | vercel env add "$key" production --yes --force 2>/dev/null || true
done < "$ENV_FILE"

# Extra vars needed for NextAuth in production
echo "  AUTH_TRUST_HOST"
printf 'true' | vercel env add AUTH_TRUST_HOST production --yes --force 2>/dev/null || true
echo "  AUTH_URL"
printf 'https://%s' "$DOMAIN" | vercel env add AUTH_URL production --yes --force 2>/dev/null || true

echo ""
echo "==> Deploying to Vercel production"
DEPLOY_URL=$(vercel --prod --yes 2>&1 | tee /dev/stderr | grep -oE 'https://pag0-demo-dashboard-[a-z0-9]+-4000ds-projects\.vercel\.app' | head -1)

if [ -z "$DEPLOY_URL" ]; then
  echo "Error: Could not extract deployment URL. Running deploy again with output:"
  vercel --prod --yes
  exit 1
fi

echo ""
echo "==> Setting alias: $DOMAIN -> $DEPLOY_URL"
vercel alias set "$DEPLOY_URL" "$DOMAIN"

echo ""
echo "==> Done! Production: https://$DOMAIN"
