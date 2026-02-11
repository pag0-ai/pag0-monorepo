#!/bin/bash
set -e

echo "========================================"
echo "  Pag0 Smart Proxy — Demo Setup"
echo "========================================"

# 1. Check Docker
echo ""
echo "[1/5] Starting Docker services (PostgreSQL + Redis)..."
pnpm docker:up
sleep 3

# 2. DB setup
echo "[2/5] Running database migration..."
pnpm db:migrate

echo "[3/5] Seeding database..."
pnpm db:seed

# 3. Start services in background
echo "[4/5] Starting Proxy server (port 3000)..."
pnpm dev:proxy &
PROXY_PID=$!
sleep 3

echo "[5/5] Starting Dashboard (port 3001)..."
pnpm dev:dashboard &
DASHBOARD_PID=$!
sleep 5

# 4. Verify
echo ""
echo "Verifying services..."
HEALTH=$(curl -s http://localhost:3000/health)
if echo "$HEALTH" | grep -q '"ok"'; then
  echo "✓ Proxy: http://localhost:3000 (running)"
else
  echo "✗ Proxy: failed to start"
fi

DASH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001)
if [ "$DASH_STATUS" = "200" ] || [ "$DASH_STATUS" = "307" ]; then
  echo "✓ Dashboard: http://localhost:3001 (running)"
else
  echo "✗ Dashboard: status $DASH_STATUS"
fi

echo ""
echo "========================================"
echo "  Demo Ready!"
echo "========================================"
echo ""
echo "  Proxy:     http://localhost:3000"
echo "  Dashboard: http://localhost:3001"
echo ""
echo "  Press Ctrl+C to stop all services"

# Wait and cleanup on exit
trap "kill $PROXY_PID $DASHBOARD_PID 2>/dev/null; echo 'Services stopped.'" EXIT
wait
