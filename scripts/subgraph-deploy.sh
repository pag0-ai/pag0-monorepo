#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SUBGRAPH_DIR="$ROOT_DIR/subgraph"

echo "==> Starting graph-node services..."
docker compose -f "$ROOT_DIR/docker-compose.yml" up -d graph-postgres ipfs graph-node

echo "==> Waiting for graph-node to be ready..."
until curl -sf http://localhost:8020 > /dev/null 2>&1; do
  sleep 2
  echo "    waiting..."
done
echo "    graph-node is ready."

echo "==> Installing subgraph dependencies..."
cd "$SUBGRAPH_DIR"
pnpm install

echo "==> Running codegen + build..."
pnpm run build

echo "==> Creating subgraph on local node..."
pnpm run create-local 2>/dev/null || echo "    (already exists, skipping)"

echo "==> Deploying subgraph..."
pnpm run deploy-local

echo ""
echo "Done! GraphQL playground: http://localhost:8000/subgraphs/name/pag0/erc8004"
