#!/bin/bash
# Pag0 MCP Agent Demo — Scenario 4
# Demonstrates AI Agent using Pag0 MCP tools via Claude Code CLI
#
# Prerequisites:
#   - Proxy running at localhost:3000 (with seeded DB)
#   - claude CLI installed and authenticated
#   - MCP package built: cd packages/mcp && npm run build

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

# Timestamp-seeded combinatorial prompts — virtually no repeats across runs
TS=$(date +%s)
STYLES=("funny" "creative" "witty" "clever" "nerdy" "absurd" "poetic" "sarcastic" "philosophical" "dramatic" "wholesome" "unexpected")
SUBJECTS=("robots" "cats" "aliens" "pirates" "penguins" "wizards" "dragons" "unicorns" "ninjas" "astronauts" "time travelers" "ghosts")
TOPICS=("programming" "AI" "databases" "the internet" "cloud computing" "open source" "cybersecurity" "APIs" "machine learning" "DevOps" "blockchain" "startups" "algorithms" "Git")

S1=$((TS % ${#STYLES[@]}))
S2=$(( (TS / ${#STYLES[@]}) % ${#SUBJECTS[@]} ))
S3=$(( (TS / (${#STYLES[@]} * ${#SUBJECTS[@]})) % ${#TOPICS[@]} ))

SWARM_PROMPT="Tell me something ${STYLES[$S1]} about ${SUBJECTS[$S2]} in one sentence"
SMART_PROMPT="Tell me a ${STYLES[$S1]} joke about ${TOPICS[$S3]} featuring ${SUBJECTS[$S2]}."

# Create temp working directory
DEMO_DIR="/tmp/pag0-mcp-demo-$(date +%s)"
mkdir -p "$DEMO_DIR"

echo -e "${BLUE}"
echo "╔══════════════════════════════════════════╗"
echo "║  Scenario 4: MCP Agent Demo              ║"
echo "║  AI Agent with Pag0 MCP Tools + CDP      ║"
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

# Ensure MCP package is built
MCP_DIR="$MONOREPO_ROOT/packages/mcp"
if [ ! -f "$MCP_DIR/dist/index.js" ]; then
  echo -e "${YELLOW}Building MCP package...${NC}"
  (cd "$MCP_DIR" && npm run build)
fi
echo -e "${GREEN}✓ MCP package built${NC}"
echo ""

# ---- Setup: Load API keys & CDP credentials ----
# Search order: packages/mcp/.env → root .env → root .env.local
for _envfile in "$MCP_DIR/.env" "$MONOREPO_ROOT/.env" "$MONOREPO_ROOT/.env.local"; do
  if [ -f "$_envfile" ]; then
    if [ -z "${CDP_API_KEY_ID:-}" ]; then
      _key=$(grep -E '^CDP_API_KEY_ID=' "$_envfile" 2>/dev/null | head -1 | cut -d'=' -f2- | sed 's/^["'\'']*//;s/["'\'']*$//' || true)
      [ -n "$_key" ] && CDP_API_KEY_ID="$_key"
    fi
    if [ -z "${CDP_API_KEY_SECRET:-}" ]; then
      _key=$(grep -E '^CDP_API_KEY_SECRET=' "$_envfile" 2>/dev/null | head -1 | cut -d'=' -f2- | sed 's/^["'\'']*//;s/["'\'']*$//' || true)
      [ -n "$_key" ] && CDP_API_KEY_SECRET="$_key"
    fi
    if [ -z "${CDP_WALLET_SECRET:-}" ]; then
      _key=$(grep -E '^CDP_WALLET_SECRET=' "$_envfile" 2>/dev/null | head -1 | cut -d'=' -f2- | sed 's/^["'\'']*//;s/["'\'']*$//' || true)
      [ -n "$_key" ] && CDP_WALLET_SECRET="$_key"
    fi
    if [ -z "${PAG0_API_KEY:-}" ]; then
      _key=$(grep -E '^PAG0_API_KEY=' "$_envfile" 2>/dev/null | head -1 | cut -d'=' -f2- | sed 's/^["'\'']*//;s/["'\'']*$//' || true)
      [ -n "$_key" ] && PAG0_API_KEY="$_key"
    fi
  fi
done

# Determine wallet mode: CDP if all 3 credentials are present
WALLET_MODE="local"
if [ -n "${CDP_API_KEY_ID:-}" ] && [ -n "${CDP_API_KEY_SECRET:-}" ] && [ -n "${CDP_WALLET_SECRET:-}" ]; then
  WALLET_MODE="cdp"
  echo -e "${GREEN}✓ CDP credentials loaded — using WALLET_MODE=cdp (Coinbase Server Wallet)${NC}"
else
  echo -e "${YELLOW}⚠ CDP credentials incomplete — using WALLET_MODE=local (ethers.Wallet)${NC}"
fi
echo ""

# ---- Setup: Load or register API key ----
if [ -n "${PAG0_API_KEY:-}" ]; then
  echo -e "${GREEN}✓ PAG0_API_KEY loaded from .env: ${PAG0_API_KEY:0:20}...${NC}"
else
  echo -e "${YELLOW}=== Setup: Creating demo user ===${NC}"
  DEMO_EMAIL="mcp-demo-${RANDOM}@pag0.io"
  REGISTER_RESP=$(curl -s -X POST "$BASE_URL/api/auth/register" \
    -H "Content-Type: application/json" \
    -d '{"email":"'"$DEMO_EMAIL"'","password":"Demo1234x","name":"MCP Agent"}')
  PAG0_API_KEY=$(echo "$REGISTER_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('apiKey',''))" 2>/dev/null || echo "")

  if [ -z "$PAG0_API_KEY" ]; then
    echo -e "${RED}✗ Failed to register demo user${NC}"
    echo "  Response: $REGISTER_RESP"
    exit 1
  fi
  echo -e "${GREEN}✓ API Key: ${PAG0_API_KEY:0:20}...${NC}"
fi

# ---- Setup: Generate wallet key (local mode only) ----
if [ "$WALLET_MODE" = "local" ]; then
  WALLET_KEY="0x$(openssl rand -hex 32)"
  echo -e "${GREEN}✓ Wallet key generated${NC}"
else
  WALLET_KEY=""
  echo -e "${GREEN}✓ Skipping local wallet key (CDP mode)${NC}"
fi

# ---- Setup: Write .mcp.json ----
NODE_BIN="$(which node)"
if [ "$WALLET_MODE" = "cdp" ]; then
cat > "$DEMO_DIR/.mcp.json" << EOF
{
  "mcpServers": {
    "pag0": {
      "command": "$NODE_BIN",
      "args": ["$MCP_DIR/dist/index.js"],
      "env": {
        "NODE_PATH": "$MCP_DIR/node_modules",
        "PAG0_API_URL": "$BASE_URL",
        "PAG0_API_KEY": "$PAG0_API_KEY",
        "WALLET_MODE": "cdp",
        "CDP_API_KEY_ID": "${CDP_API_KEY_ID}",
        "CDP_API_KEY_SECRET": "${CDP_API_KEY_SECRET}",
        "CDP_WALLET_SECRET": "${CDP_WALLET_SECRET}",
        "NETWORK": "base-sepolia"
      }
    }
  }
}
EOF
else
cat > "$DEMO_DIR/.mcp.json" << EOF
{
  "mcpServers": {
    "pag0": {
      "command": "$NODE_BIN",
      "args": ["$MCP_DIR/dist/index.js"],
      "env": {
        "NODE_PATH": "$MCP_DIR/node_modules",
        "PAG0_API_URL": "$BASE_URL",
        "PAG0_API_KEY": "$PAG0_API_KEY",
        "WALLET_MODE": "local",
        "WALLET_PRIVATE_KEY": "$WALLET_KEY",
        "NETWORK": "base-sepolia"
      }
    }
  }
}
EOF
fi
echo -e "${GREEN}✓ MCP config written to $DEMO_DIR/.mcp.json (mode: $WALLET_MODE)${NC}"
echo ""

# ---- Helper: run agent step ----
run_agent() {
  local step="$1" desc="$2" prompt="$3"

  echo -e "${BLUE}╔═══════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║  Step ${step}: ${desc}${NC}"
  echo -e "${BLUE}╚═══════════════════════════════════════════════╝${NC}"
  echo -e "${CYAN}Prompt: ${prompt:0:280}...${NC}"
  echo ""

  local output
  if output=$(cd "$MONOREPO_ROOT" && claude -p "$prompt" \
    --mcp-config "$DEMO_DIR/.mcp.json" \
    --strict-mcp-config \
    --setting-sources "local" \
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
run_agent "4.1" "Wallet Setup (CDP)" \
  "Use the pag0_wallet_status tool to check my wallet. Show my address, network, balance, and wallet mode (should be CDP)."

# ===== Step 4.2: Environment Health Check =====
run_agent "4.2" "Environment Health Check" \
  "Run a health check on my Pag0 environment:
1. Use pag0_check_budget to show my daily and monthly budget status.
2. Use pag0_list_policies to list my spending policies.
Summarize the results."

# ===== Step 4.3: Get AI Agent Recommendations =====
run_agent "4.3" "Get AI Agent Recommendations" \
  "Use the pag0_recommend tool to get top 3 recommended APIs in the 'AI Agents' category. For each endpoint, show: name, overall score, number of available resources, and the top 2-3 resource paths with their HTTP method and cost (e.g. POST /x402/swarm/... — 0.01 USDC). This shows agents can discover exactly which APIs to call."

# ===== Step 4.4: Compare Endpoints =====
run_agent "4.4" "Compare Endpoints" \
  "Use the pag0_compare tool to compare api-dev.intra-tls2.dctx.link and api-staging.intra-tls2.dctx.link. Show which one wins overall and in each dimension (cost, latency, reliability). Also compare the number of available API resources each endpoint offers."

# ===== Step 4.5: x402 Payment Demo (reliable endpoint) =====
run_agent "4.5" "x402 Payment (Math API)" \
  "Demonstrate the full resource discovery → payment flow:
1. First, use pag0_score to look up x402-ai-starter-alpha.vercel.app and find its available API resources.
2. Pick the first resource. Note the HTTP method and path from the resource data.
3. Use pag0_request to call the full URL (https://x402-ai-starter-alpha.vercel.app + resource path) with the method from the resource. This is a math API — send a JSON body with two numbers to add.
Show: the discovered resource (method, path, cost), then the payment result (status, response body, cost in USDC, latency, remaining budget)."

# ===== Step 4.6: Second x402 Payment (different provider) =====
run_agent "4.6" "x402 Payment (Motivate API)" \
  "Demonstrate resource discovery with a different provider:
1. Use pag0_score to look up x402-motivate-api.vercel.app and find its available resources.
2. Note the resource's HTTP method, path, cost, and description.
3. Use pag0_request to call the endpoint using the method and path from the resource data.
Show: the discovered resource info, then the response (status, body, cost in USDC, latency, remaining budget). Compare cost vs the math API call."

# ===== Step 4.7: Accounting Check =====
run_agent "4.7" "Accounting Check" \
  "Check my account after the API calls:
1. Use pag0_spending with period '1h' to show recent spending.
2. Use pag0_cache_stats to show cache performance.
Summarize the total cost and any savings from caching."

# ===== Step 4.8: Individual Endpoint Score =====
run_agent "4.8" "Individual Endpoint Score" \
  "Use the pag0_score tool to get the detailed score for api.grapevine.markets. Show the overall score, individual dimension scores (cost, latency, reliability), weights, and evidence (sample size, period, success rate). Also show the available API resources — list the first 5 resource paths with their HTTP method and cost. This endpoint has multiple data feed resources with varying prices."

# ===== Step 4.9: Transaction History =====
run_agent "4.9" "Transaction History" \
  "Use pag0_tx_history with period '24h' to show recent transaction history. For each transaction, show the endpoint, cost, latency, and whether it was cached."

# ===== Step 4.10: On-Chain Audit Trail (ERC-8004) =====
run_agent "4.10" "On-Chain Audit Trail (ERC-8004)" \
  "Use pag0_audit_trail without an endpoint filter (period 'week') to show ALL recent on-chain ERC-8004 feedback events. For each event, show the agentId, quality score (value), tags, timestamp, and transaction hash. This data is indexed from the SKALE blockchain via a subgraph — it proves every API payment is auditable on-chain."

# ===== Summary =====
echo -e "${BLUE}"
echo "╔══════════════════════════════════════════╗"
echo "║  MCP Agent Demo Complete!                ║"
echo "╚══════════════════════════════════════════╝"
echo -e "${NC}"

echo -e "  ${GREEN}Passed: $PASS${NC}  ${RED}Failed: $FAIL${NC}  Total: $((PASS + FAIL)) / 10"
echo ""
echo -e "  Temp dir: ${CYAN}$DEMO_DIR${NC}"
echo -e "  MCP config: ${CYAN}$DEMO_DIR/.mcp.json${NC}"
echo ""

if [ "$FAIL" -eq 0 ]; then
  echo -e "${GREEN}All steps passed!${NC}"
else
  echo -e "${YELLOW}Some steps failed — check output above for details.${NC}"
fi
