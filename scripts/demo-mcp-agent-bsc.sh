#!/bin/bash
# Pag0 MCP Agent Demo — BSC (BNB Chain) Version
# Demonstrates AI Agent using Pag0 MCP tools on BSC with USDT payments via Permit2 Local Facilitator
#
# Prerequisites:
#   - Proxy running at localhost:3000 (with BSC seeded DB: pnpm db:seed)
#   - claude CLI installed and authenticated
#   - MCP package built: cd packages/mcp && npm run build
#   - WALLET_PRIVATE_KEY set in .env (BSC wallet with USDT + BNB for gas)

set -euo pipefail

MONOREPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

PASS=0
FAIL=0

# Timestamp-seeded randomization — cache-busting across runs
TS=$(date +%s)

# Popular BSC token addresses for AI token analysis (Step 7)
BSC_TOKENS=("0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82" "0x2170Ed0880ac9A755fd29B2688956BD959F933F8" "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c" "0x1D2F0da169ceB9fC7B3144628dB156f3F6c60dBE" "0x3EE2200Efb3400fAbB9AacF31297cBdD1d435D47" "0xBf5140A22578168FD562DCcF235E5D43A02ce9B1")
BSC_TOKEN_NAMES=("CAKE" "ETH (Binance-Peg)" "BTCB" "XRP (BSC)" "ADA (BSC)" "UNI (BSC)")

# Varying BNB amounts for PancakeSwap quote (Step 6)
BNB_AMOUNTS=("500000000000000000" "1000000000000000000" "1500000000000000000" "2000000000000000000" "3000000000000000000" "5000000000000000000")
BNB_LABELS=("0.5 BNB" "1 BNB" "1.5 BNB" "2 BNB" "3 BNB" "5 BNB")

T1=$((TS % ${#BSC_TOKENS[@]}))
T2=$(( (TS / ${#BSC_TOKENS[@]}) % ${#BNB_AMOUNTS[@]} ))
NONCE=$((TS % 100000))

SELECTED_TOKEN="${BSC_TOKENS[$T1]}"
SELECTED_TOKEN_NAME="${BSC_TOKEN_NAMES[$T1]}"
SELECTED_AMOUNT="${BNB_AMOUNTS[$T2]}"
SELECTED_AMOUNT_LABEL="${BNB_LABELS[$T2]}"

echo -e "${CYAN}Randomized inputs: token=${SELECTED_TOKEN_NAME}, amount=${SELECTED_AMOUNT_LABEL}, nonce=${NONCE}${NC}"

# Create temp working directory
DEMO_DIR="/tmp/pag0-mcp-demo-bsc-$(date +%s)"
mkdir -p "$DEMO_DIR"

# Ensure MCP package is built
MCP_DIR="$MONOREPO_ROOT/packages/mcp"
if [ ! -f "$MCP_DIR/dist/index.js" ]; then
  echo -e "${YELLOW}Building MCP package...${NC}"
  (cd "$MCP_DIR" && npm run build)
fi
echo -e "${GREEN}✓ MCP package built${NC}"
echo ""

# ---- Setup: Load env vars ----
# Search order: packages/mcp/.env → root .env → root .env.local
for _envfile in "$MCP_DIR/.env" "$MONOREPO_ROOT/.env" "$MONOREPO_ROOT/.env.local"; do
  if [ -f "$_envfile" ]; then
    if [ -z "${WALLET_PRIVATE_KEY:-}" ]; then
      _key=$(grep -E '^WALLET_PRIVATE_KEY=' "$_envfile" 2>/dev/null | head -1 | cut -d'=' -f2- | sed 's/^["'\'']*//;s/["'\'']*$//' || true)
      [ -n "$_key" ] && WALLET_PRIVATE_KEY="$_key"
    fi
    if [ -z "${PAG0_API_KEY:-}" ]; then
      _key=$(grep -E '^PAG0_API_KEY=' "$_envfile" 2>/dev/null | head -1 | cut -d'=' -f2- | sed 's/^["'\'']*//;s/["'\'']*$//' || true)
      [ -n "$_key" ] && PAG0_API_KEY="$_key"
    fi
    if [ -z "${PAG0_API_URL:-}" ]; then
      _key=$(grep -E '^PAG0_API_URL=' "$_envfile" 2>/dev/null | head -1 | cut -d'=' -f2- | sed 's/^["'\'']*//;s/["'\'']*$//' || true)
      [ -n "$_key" ] && PAG0_API_URL="$_key"
    fi
  fi
done

BASE_URL="${PAG0_API_URL:-http://localhost:3000}"

echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════╗"
echo "║  Pag0 MCP Agent Demo — BNB Chain (BSC)       ║"
echo "║  AI Agent with x402 + USDT + Permit2        ║"
echo "╚══════════════════════════════════════════════╝"
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

# BSC always uses local wallet mode
WALLET_MODE="local"
if [ -n "${WALLET_PRIVATE_KEY:-}" ]; then
  echo -e "${GREEN}✓ WALLET_PRIVATE_KEY loaded from .env${NC}"
else
  # Generate a random wallet for demo (needs manual USDT funding for real payments)
  WALLET_PRIVATE_KEY="0x$(openssl rand -hex 32)"
  echo -e "${YELLOW}⚠ No WALLET_PRIVATE_KEY found — generated random key (fund with USDT+BNB for real payments)${NC}"
fi
echo ""

# ---- Setup: Load or register API key ----
if [ -n "${PAG0_API_KEY:-}" ]; then
  echo -e "${GREEN}✓ PAG0_API_KEY loaded from .env: ${PAG0_API_KEY:0:20}...${NC}"
else
  echo -e "${YELLOW}=== Setup: Creating demo user ===${NC}"
  DEMO_EMAIL="mcp-bsc-demo-${RANDOM}@pag0.io"
  REGISTER_RESP=$(curl -s -X POST "$BASE_URL/api/auth/register" \
    -H "Content-Type: application/json" \
    -d '{"email":"'"$DEMO_EMAIL"'","password":"Demo1234x","name":"MCP BSC Agent"}')
  PAG0_API_KEY=$(echo "$REGISTER_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('apiKey',''))" 2>/dev/null || echo "")

  if [ -z "$PAG0_API_KEY" ]; then
    echo -e "${RED}✗ Failed to register demo user${NC}"
    echo "  Response: $REGISTER_RESP"
    exit 1
  fi
  echo -e "${GREEN}✓ API Key: ${PAG0_API_KEY:0:20}...${NC}"
fi

# ---- Setup: Write .mcp.json (BSC local wallet only) ----
NODE_BIN="$(which node)"
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
        "WALLET_PRIVATE_KEY": "$WALLET_PRIVATE_KEY",
        "NETWORK": "bsc"
      }
    }
  }
}
EOF
echo -e "${GREEN}✓ MCP config written to $DEMO_DIR/.mcp.json (network: bsc, wallet: local)${NC}"
echo ""

# ---- Helper: run agent step ----
run_agent() {
  local step="$1" desc="$2" prompt="$3"

  # Recording mode: pause before each step
  if [ "${DEMO_PAUSE:-}" = "1" ]; then
    echo -e "${YELLOW}▶ Press Enter to run Step ${step}: ${desc}${NC}"
    read -r
  fi

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

# ===== Step 1: Wallet Setup (BSC Local) =====
run_agent "1" "Wallet Setup (BSC Local)" \
  "Use the pag0_wallet_status tool to check my wallet. Show my address, network (should be BSC / eip155:56), balance (in USDT), and wallet mode (should be local)."

# ===== Step 1.5: Permit2 Approval =====
run_agent "1.5" "Permit2 Approval (BSC USDT)" \
  "Use pag0_wallet_status to check if Permit2 is approved. If permit2.approved is false, use pag0_approve_permit2 to approve the Permit2 contract for USDT spending on BSC. This is a one-time on-chain transaction (~\$0.01 BNB gas). Show the approval status and tx hash if a new approval was made."

# ===== Step 2: Environment Health Check =====
run_agent "2" "Environment Health Check" \
  "Run a health check on my Pag0 environment:
1. Use pag0_check_budget to show my daily and monthly budget status.
2. Use pag0_list_policies to list my spending policies.
Summarize the results."

# ===== Step 3: Get DeFi Recommendations on BSC =====
run_agent "3" "Get DeFi Recommendations (BSC)" \
  "Use the pag0_recommend tool to get recommended APIs in the 'DeFi' category. For each endpoint, show: name, overall score, number of available resources, and the resource paths with their HTTP method and cost (in USDT). This shows agents can discover BNB Chain DeFi APIs to call."

# ===== Step 4: Individual Endpoint Score (BSC APIs) =====
run_agent "4" "Individual Endpoint Score (BSC)" \
  "Use the pag0_score tool to get the detailed score for localhost (or the proxy host). Show the overall score, individual dimension scores (cost, latency, reliability), and the available API resources — list all resource paths with their HTTP method, cost, and description. These are self-hosted BNB Chain DeFi APIs."

# ===== Step 5: x402 Payment — Venus Protocol Rates =====
run_agent "5" "x402 Payment (Venus Rates)" \
  "Demonstrate resource discovery and x402 payment on BNB Chain:
1. Use pag0_score to look up the proxy host and find its BSC API resources.
2. Find the Venus Protocol lending rates resource (/bsc/defi/venus/rates, GET method).
3. Use pag0_request to call the full URL (${BASE_URL}/bsc/defi/venus/rates?_t=${NONCE}) with method GET.
Show: the discovered resource info, then the payment result (status, response body, cost in USDT, latency, remaining budget). This is an x402 payment on BSC via Permit2."

# ===== Step 6: x402 Payment — PancakeSwap Quote =====
run_agent "6" "x402 Payment (PancakeSwap Quote)" \
  "Demonstrate a second x402 payment on BNB Chain:
1. Use pag0_request to call ${BASE_URL}/bsc/defi/pancake/quote with method GET and query params tokenIn=0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c (WBNB) and tokenOut=0x55d398326f99059fF775485246999027B3197955 (USDT) and amount=${SELECTED_AMOUNT} (${SELECTED_AMOUNT_LABEL}).
Show: the response (status, body, cost in USDT, latency, remaining budget). Compare cost vs the Venus rates call."

# ===== Step 7: x402 Payment — AI Token Analysis =====
run_agent "7" "x402 Payment (AI Token Analysis)" \
  "Demonstrate a higher-cost x402 payment on BNB Chain:
1. Use pag0_request to call ${BASE_URL}/bsc/ai/analyze-token with method POST and JSON body {\"tokenAddress\": \"${SELECTED_TOKEN}\"} (${SELECTED_TOKEN_NAME} token on BSC).
Show: the response (status, body with risk analysis, cost in USDT, latency, remaining budget). Note this costs \$0.005 vs \$0.001 for the DeFi endpoints."

# ===== Step 8: Accounting Check =====
run_agent "8" "Accounting Check" \
  "Check my account after the BSC API calls:
1. Use pag0_spending with period '1h' to show recent spending.
2. Use pag0_cache_stats to show cache performance.
Summarize the total cost in USDT and any savings from caching."

# ===== Step 9: Transaction History =====
run_agent "9" "Transaction History" \
  "Use pag0_tx_history with period '24h' to show recent transaction history. For each transaction, show the endpoint, cost (in USDT), latency, and whether it was cached. All transactions should be on BSC (chain_id: 56)."

# ===== Step 10: On-Chain Audit Trail (ERC-8004 on BSC) =====
run_agent "10" "On-Chain Audit Trail (ERC-8004 on BSC)" \
  "Use pag0_audit_trail without an endpoint filter (period 'week') to show ALL recent on-chain ERC-8004 feedback events. For each event, show the agentId, quality score (value), tags, timestamp, and transaction hash. This data is from the BSC blockchain — it proves every API payment is auditable on-chain via BSCScan."

# ===== Summary =====
echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════╗"
echo "║  BSC MCP Agent Demo Complete!                ║"
echo "╚══════════════════════════════════════════════╝"
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
