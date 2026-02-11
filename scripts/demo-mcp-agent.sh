#!/bin/bash
# Pag0 MCP Agent Demo — Scenario 4
# Demonstrates AI Agent using Pag0 MCP tools via Claude Code CLI
#
# Prerequisites:
#   - Proxy running at localhost:3000 (with seeded DB)
#   - claude CLI installed and authenticated
#   - npx / tsx available

set -euo pipefail

BASE_URL="http://localhost:3000"
MONOREPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

PASS=0
FAIL=0

# Create temp working directory
DEMO_DIR="/tmp/pag0-mcp-demo-$(date +%s)"
mkdir -p "$DEMO_DIR"

echo -e "${BLUE}"
echo "╔══════════════════════════════════════════╗"
echo "║  Scenario 4: MCP Agent Demo              ║"
echo "║  AI Agent with Pag0 MCP Tools            ║"
echo "╚══════════════════════════════════════════╝"
echo -e "${NC}"

# ---- Preflight checks ----
echo -e "${YELLOW}Preflight checks...${NC}"

if ! command -v claude &>/dev/null; then
  echo -e "${RED}✗ claude CLI not found. Install: https://docs.anthropic.com/en/docs/claude-code${NC}"
  exit 1
fi
echo -e "${GREEN}✓ claude CLI found${NC}"

if ! curl -sf "$BASE_URL/health" &>/dev/null; then
  echo -e "${RED}✗ Proxy not running at $BASE_URL${NC}"
  echo "  Start with: pnpm dev:proxy"
  exit 1
fi
echo -e "${GREEN}✓ Proxy running at $BASE_URL${NC}"

if ! command -v npx &>/dev/null; then
  echo -e "${RED}✗ npx not found${NC}"
  exit 1
fi
echo -e "${GREEN}✓ npx available${NC}"
echo ""

# ---- Setup: Register demo user ----
echo -e "${YELLOW}=== Setup: Creating demo user ===${NC}"
DEMO_EMAIL="mcp-demo-${RANDOM}@pag0.io"
REGISTER_RESP=$(curl -s -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"'"$DEMO_EMAIL"'","password":"Demo1234x","name":"MCP Agent"}')
API_KEY=$(echo "$REGISTER_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('apiKey',''))" 2>/dev/null || echo "")

if [ -z "$API_KEY" ]; then
  echo -e "${RED}✗ Failed to register demo user${NC}"
  echo "  Response: $REGISTER_RESP"
  exit 1
fi
echo -e "${GREEN}✓ API Key: ${API_KEY:0:20}...${NC}"

# ---- Setup: Generate wallet key ----
WALLET_KEY="0x$(openssl rand -hex 32)"
echo -e "${GREEN}✓ Wallet key generated${NC}"

# ---- Setup: Write .mcp.json ----
cat > "$DEMO_DIR/.mcp.json" << EOF
{
  "mcpServers": {
    "pag0": {
      "command": "npx",
      "args": ["tsx", "$MONOREPO_ROOT/packages/mcp/src/index.ts"],
      "env": {
        "PAG0_API_URL": "$BASE_URL",
        "PAG0_API_KEY": "$API_KEY",
        "WALLET_PRIVATE_KEY": "$WALLET_KEY",
        "NETWORK": "skale"
      }
    }
  }
}
EOF
echo -e "${GREEN}✓ MCP config written to $DEMO_DIR/.mcp.json${NC}"
echo ""

# ---- Helper: run agent step ----
run_agent() {
  local step="$1" desc="$2" prompt="$3"

  echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║  Step ${step}: ${desc}${NC}"
  echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
  echo -e "${CYAN}Prompt: ${prompt:0:80}...${NC}"
  echo ""

  local output
  if output=$(cd "$DEMO_DIR" && claude -p "$prompt" \
    --mcp-config "$DEMO_DIR/.mcp.json" \
    --permission-mode bypassPermissions \
    --no-session-persistence \
    --model sonnet 2>&1); then
    echo "$output"
    echo ""
    echo -e "${GREEN}✓ Step $step passed${NC}"
    PASS=$((PASS + 1))
  else
    echo "$output"
    echo ""
    echo -e "${RED}✗ Step $step failed${NC}"
    FAIL=$((FAIL + 1))
  fi
  echo ""
}

# ===== Step 4.1: Wallet Setup =====
run_agent "4.1" "Wallet Setup" \
  "Use the pag0_wallet_status tool to check my wallet. Show my address, network, and balance."

# ===== Step 4.2: Environment Health Check =====
run_agent "4.2" "Environment Health Check" \
  "Run a health check on my Pag0 environment:
1. Use pag0_check_budget to show my daily and monthly budget status.
2. Use pag0_list_policies to list my spending policies.
Summarize the results."

# ===== Step 4.3: Get AI Recommendations =====
run_agent "4.3" "Get AI Recommendations" \
  "Use the pag0_recommend tool to get top 3 recommended APIs in the AI category. Show each endpoint's name and score."

# ===== Step 4.4: Compare Endpoints =====
run_agent "4.4" "Compare Endpoints" \
  "Use the pag0_compare tool to compare api.openai.com and api.anthropic.com. Show which one wins overall and in each dimension (cost, latency, reliability)."

# ===== Step 4.5: API Call via Proxy =====
run_agent "4.5" "API Call via Proxy" \
  "Use the pag0_request tool to make a GET request to https://api.openai.com/v1/models through the Pag0 proxy. Report the response status, cost, cache status, and latency."

# ===== Step 4.6: Accounting Check =====
run_agent "4.6" "Accounting Check" \
  "Check my account after the API call:
1. Use pag0_spending with period '1h' to show recent spending.
2. Use pag0_cache_stats to show cache performance.
Summarize the total cost and any savings from caching."

# ===== Summary =====
echo -e "${BLUE}"
echo "╔══════════════════════════════════════════╗"
echo "║  MCP Agent Demo Complete!                ║"
echo "╚══════════════════════════════════════════╝"
echo -e "${NC}"

echo -e "  ${GREEN}Passed: $PASS${NC}  ${RED}Failed: $FAIL${NC}  Total: $((PASS + FAIL))"
echo ""
echo -e "  Temp dir: ${CYAN}$DEMO_DIR${NC}"
echo -e "  MCP config: ${CYAN}$DEMO_DIR/.mcp.json${NC}"
echo ""

if [ "$FAIL" -eq 0 ]; then
  echo -e "${GREEN}All steps passed!${NC}"
else
  echo -e "${YELLOW}Some steps failed — check output above for details.${NC}"
fi
