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
    if [ -z "${OPENAI_API_KEY:-}" ]; then
      _key=$(grep -E '^OPENAI_API_KEY=' "$_envfile" 2>/dev/null | head -1 | cut -d'=' -f2- | sed 's/^["'\'']*//;s/["'\'']*$//' || true)
      [ -n "$_key" ] && OPENAI_API_KEY="$_key"
    fi
    if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
      _key=$(grep -E '^ANTHROPIC_API_KEY=' "$_envfile" 2>/dev/null | head -1 | cut -d'=' -f2- | sed 's/^["'\'']*//;s/["'\'']*$//' || true)
      [ -n "$_key" ] && ANTHROPIC_API_KEY="$_key"
    fi
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
  fi
done
if [ -z "${OPENAI_API_KEY:-}" ]; then
  echo -e "${YELLOW}OPENAI_API_KEY not found in environment or .env files.${NC}"
  read -rp "Enter your OpenAI API key (or press Enter to skip): " OPENAI_API_KEY
fi
if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
  echo -e "${YELLOW}ANTHROPIC_API_KEY not found in environment or .env files.${NC}"
  read -rp "Enter your Anthropic API key (or press Enter to skip): " ANTHROPIC_API_KEY
fi
if [ -n "${OPENAI_API_KEY:-}" ]; then
  echo -e "${GREEN}✓ OPENAI_API_KEY loaded${NC}"
else
  echo -e "${YELLOW}⚠ OPENAI_API_KEY not set — Step 4.5 may return 401 for OpenAI${NC}"
fi
if [ -n "${ANTHROPIC_API_KEY:-}" ]; then
  echo -e "${GREEN}✓ ANTHROPIC_API_KEY loaded${NC}"
else
  echo -e "${YELLOW}⚠ ANTHROPIC_API_KEY not set — Step 4.5 may return 401 for Anthropic${NC}"
fi

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
# Check PAG0_API_KEY from .env files first
API_KEY=""
for _envfile in "$MCP_DIR/.env" "$MONOREPO_ROOT/.env" "$MONOREPO_ROOT/.env.local"; do
  if [ -f "$_envfile" ] && [ -z "$API_KEY" ]; then
    _key=$(grep -E '^PAG0_API_KEY=' "$_envfile" 2>/dev/null | head -1 | cut -d'=' -f2- | sed 's/^["'\'']*//;s/["'\'']*$//' || true)
    [ -n "$_key" ] && API_KEY="$_key"
  fi
done

if [ -n "$API_KEY" ]; then
  echo -e "${GREEN}✓ PAG0_API_KEY loaded from .env: ${API_KEY:0:20}...${NC}"
else
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
        "PAG0_API_KEY": "$API_KEY",
        "WALLET_MODE": "cdp",
        "CDP_API_KEY_ID": "${CDP_API_KEY_ID}",
        "CDP_API_KEY_SECRET": "${CDP_API_KEY_SECRET}",
        "CDP_WALLET_SECRET": "${CDP_WALLET_SECRET}",
        "NETWORK": "base-sepolia",
        "OPENAI_API_KEY": "${OPENAI_API_KEY:-}",
        "ANTHROPIC_API_KEY": "${ANTHROPIC_API_KEY:-}"
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
        "PAG0_API_KEY": "$API_KEY",
        "WALLET_MODE": "local",
        "WALLET_PRIVATE_KEY": "$WALLET_KEY",
        "NETWORK": "base-sepolia",
        "OPENAI_API_KEY": "${OPENAI_API_KEY:-}",
        "ANTHROPIC_API_KEY": "${ANTHROPIC_API_KEY:-}"
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

  echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║  Step ${step}: ${desc}${NC}"
  echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
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

# ===== Step 4.5: Naive Select & Call (multi-tool orchestration) =====
run_agent "4.5" "Naive Select and Call" \
  "You are demonstrating Pag0's smart API selection the MANUAL way — using multiple tools. Do the following steps in order:

1. Use pag0_recommend to get the top recommended APIs in the AI category.

2. Pick the top 2 endpoints from step 1 and use pag0_compare to compare them. Show the comparison table.

3. Identify the overall winner from step 2.

4. Call the winning provider via pag0_request. Use the winner's hostname to build the request:
   - If the winner is api.openai.com: POST https://api.openai.com/v1/chat/completions with body {\"model\":\"gpt-4o-mini\",\"messages\":[{\"role\":\"user\",\"content\":\"What is the x402 payment protocol? Answer in one sentence.\"}],\"max_tokens\":100}
   - If the winner is api.anthropic.com: POST https://api.anthropic.com/v1/messages with body {\"model\":\"claude-sonnet-4-20250514\",\"max_tokens\":100,\"messages\":[{\"role\":\"user\",\"content\":\"What is the x402 payment protocol? Answer in one sentence.\"}]}

5. Show a summary: which provider was selected, why (score breakdown), and the API response with latency/cost/cache metadata."

# ===== Step 4.6: Smart Select & Call (single tool) =====
run_agent "4.6" "Smart Select and Call" \
  "Use the pag0_smart_request tool to ask an AI API: 'What is the x402 payment protocol? Answer in one sentence.'

Use category 'AI' and max_tokens 100."

# ===== Step 4.7: Accounting Check =====
run_agent "4.7" "Accounting Check" \
  "Check my account after the API calls (both the naive multi-tool call and the smart single-tool call):
1. Use pag0_spending with period '1h' to show recent spending.
2. Use pag0_cache_stats to show cache performance.
Summarize the total cost and any savings from caching."

# ===== Summary =====
echo -e "${BLUE}"
echo "╔══════════════════════════════════════════╗"
echo "║  MCP Agent Demo Complete!                ║"
echo "╚══════════════════════════════════════════╝"
echo -e "${NC}"

echo -e "  ${GREEN}Passed: $PASS${NC}  ${RED}Failed: $FAIL${NC}  Total: $((PASS + FAIL)) / 7"
echo ""
echo -e "  Temp dir: ${CYAN}$DEMO_DIR${NC}"
echo -e "  MCP config: ${CYAN}$DEMO_DIR/.mcp.json${NC}"
echo ""

if [ "$FAIL" -eq 0 ]; then
  echo -e "${GREEN}All steps passed!${NC}"
else
  echo -e "${YELLOW}Some steps failed — check output above for details.${NC}"
fi
