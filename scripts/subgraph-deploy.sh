#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SUBGRAPH_DIR="$ROOT_DIR/subgraph"

echo "==> Starting graph-node services..."
docker compose -f "$ROOT_DIR/docker-compose.yml" up -d graph-postgres ipfs graph-node

echo "==> Waiting for graph-node to be ready..."
until curl -s -o /dev/null -w '%{http_code}' http://localhost:8020 2>/dev/null | grep -q '[2-4]'; do
  sleep 2
  echo "    waiting..."
done
echo "    graph-node is ready."

echo "==> Installing subgraph dependencies..."
cd "$SUBGRAPH_DIR"
npm install

GRAPH="./node_modules/.bin/graph"

echo "==> Running codegen + build..."
$GRAPH codegen
$GRAPH build

echo "==> Creating subgraph on local node..."
$GRAPH create --node http://localhost:8020/ pag0/erc8004 2>/dev/null || echo "    (already exists, skipping)"

echo "==> Deploying subgraph..."
$GRAPH deploy --node http://localhost:8020/ --ipfs http://localhost:5001 --version-label v0.0.1 pag0/erc8004

echo ""
echo "Done! GraphQL playground: http://localhost:8000/subgraphs/name/pag0/erc8004"
