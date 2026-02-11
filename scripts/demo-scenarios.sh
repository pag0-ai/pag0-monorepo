#!/bin/bash
BASE_URL="http://localhost:3000"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Helper to show and run a command
run_demo() {
  echo -e "${CYAN}$ $1${NC}"
  eval "$1"
  echo ""
}

pause() {
  echo -e "\n${YELLOW}Press Enter to continue...${NC}"
  read
}

echo -e "${BLUE}"
echo "╔══════════════════════════════════════════╗"
echo "║     Pag0 Smart Proxy — Live Demo         ║"
echo "╚══════════════════════════════════════════╝"
echo -e "${NC}"

# Setup: Register demo user
echo -e "${YELLOW}=== Setup: Creating demo user ===${NC}"
REGISTER_RESP=$(curl -s -X POST $BASE_URL/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"demo-$(date +%s)@pag0.io\",\"password\":\"Demo1234!\",\"name\":\"Demo User\"}")
API_KEY=$(echo "$REGISTER_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('apiKey',''))" 2>/dev/null || echo "")

if [ -z "$API_KEY" ]; then
  echo "Failed to register. Using existing seed data..."
  # You can set a known API key here from seed data
  echo "Please set API_KEY manually and re-run."
  exit 1
fi
echo -e "${GREEN}✓ API Key: ${API_KEY:0:20}...${NC}"

pause

# ===== SCENARIO 1: Spend Firewall =====
echo -e "${BLUE}"
echo "╔══════════════════════════════════════════╗"
echo "║  Scenario 1: Spend Firewall              ║"
echo "║  AI Agent budget enforcement              ║"
echo "╚══════════════════════════════════════════╝"
echo -e "${NC}"

echo -e "${YELLOW}1.1 Check current budget status${NC}"
run_demo "curl -s '$BASE_URL/api/analytics/summary?period=24h' -H 'X-Pag0-API-Key: $API_KEY' | python3 -m json.tool"

echo -e "${YELLOW}1.2 Create a strict policy (daily limit: \$1)${NC}"
POLICY_RESP=$(curl -s -X POST $BASE_URL/api/policies \
  -H "Content-Type: application/json" \
  -H "X-Pag0-API-Key: $API_KEY" \
  -d '{"name":"Strict Demo Policy","maxPerRequest":"500000","dailyBudget":"1000000","monthlyBudget":"10000000"}')
echo "$POLICY_RESP" | python3 -m json.tool 2>/dev/null || echo "$POLICY_RESP"

echo -e "${YELLOW}1.3 View policies${NC}"
run_demo "curl -s '$BASE_URL/api/policies' -H 'X-Pag0-API-Key: $API_KEY' | python3 -m json.tool"

echo -e "${GREEN}→ Policy enforces: max \$0.50/request, \$1/day, \$10/month${NC}"

pause

# ===== SCENARIO 2: Smart Cache =====
echo -e "${BLUE}"
echo "╔══════════════════════════════════════════╗"
echo "║  Scenario 2: Smart Cache                  ║"
echo "║  40%+ cost savings through caching         ║"
echo "╚══════════════════════════════════════════╝"
echo -e "${NC}"

echo -e "${YELLOW}2.1 Check cache stats (before)${NC}"
run_demo "curl -s '$BASE_URL/api/analytics/cache?period=24h' -H 'X-Pag0-API-Key: $API_KEY' | python3 -m json.tool"

echo -e "${YELLOW}2.2 View cache savings on Dashboard${NC}"
echo -e "${CYAN}→ Open http://localhost:3001/dashboard to see Cache Savings card${NC}"

echo -e "${GREEN}→ Identical requests served from cache at \$0 cost${NC}"

pause

# ===== SCENARIO 3: API Curation =====
echo -e "${BLUE}"
echo "╔══════════════════════════════════════════╗"
echo "║  Scenario 3: API Curation                 ║"
echo "║  Smart API recommendations & comparison    ║"
echo "╚══════════════════════════════════════════╝"
echo -e "${NC}"

echo -e "${YELLOW}3.1 View AI category rankings${NC}"
run_demo "curl -s '$BASE_URL/api/curation/rankings?category=AI' -H 'X-Pag0-API-Key: $API_KEY' | python3 -m json.tool"

echo -e "${YELLOW}3.2 Get recommendations (cost-optimized)${NC}"
run_demo "curl -s '$BASE_URL/api/curation/recommend?category=AI&limit=3&sortBy=cost' -H 'X-Pag0-API-Key: $API_KEY' | python3 -m json.tool"

echo -e "${YELLOW}3.3 Compare endpoints${NC}"
run_demo "curl -s '$BASE_URL/api/curation/compare?endpoints=api.openai.com,api.anthropic.com' -H 'X-Pag0-API-Key: $API_KEY' | python3 -m json.tool"

echo -e "${YELLOW}3.4 View Rankings Board${NC}"
echo -e "${CYAN}→ Open http://localhost:3001/rankings${NC}"

echo -e "${GREEN}→ Data-driven scoring: cost (40%) + latency (30%) + reliability (30%)${NC}"

echo ""
echo -e "${BLUE}"
echo "╔══════════════════════════════════════════╗"
echo "║  Demo Complete!                            ║"
echo "║                                            ║"
echo "║  Pag0 = Spend Firewall + Smart Cache       ║"
echo "║         + API Curation                     ║"
echo "║                                            ║"
echo "║  Dashboard: http://localhost:3001           ║"
echo "╚══════════════════════════════════════════╝"
echo -e "${NC}"
