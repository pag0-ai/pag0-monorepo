# MCP Agent Demo Script Guide — BNB Chain (BSC)

`scripts/demo-mcp-agent-bsc.sh` is an E2E demo script that automatically runs 10 Pag0 MCP tools on BNB Chain via the Claude Code CLI, using USDT payments through Permit2.

## Prerequisites

- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed and authenticated
- Node.js >= 20
- pnpm >= 9

## 0. Clone the Repository

This monorepo uses git submodules for `packages/proxy` and `packages/dashboard` (private repos). **The demo script only requires `packages/mcp` (public)**, so you do not need access to the private submodules.

```bash
# Standard clone (no submodule access needed for the demo)
git clone https://github.com/pag0-ai/pag0-monorepo.git
cd pag0-monorepo
```

> **For team members** with private repo access:
>
> ```bash
> git clone --recurse-submodules git@github.com:pag0-ai/pag0-monorepo.git
> ```

## 1. Get an API Key

You need to create an API Key from the Pag0 Dashboard.

1. Go to [Pag0 Dashboard](https://pag0-dashboard.vercel.app)
2. Sign up or log in
3. Copy your API Key from the dashboard (`pag0_live_...` format)

> If you skip this step, the demo script will auto-register a temporary demo user.

## 2. Wallet Setup (BSC Local Wallet)

The BSC demo uses a **local ethers.Wallet** exclusively (CDP Server Wallet does not support BSC).

Your wallet needs:

| Asset | Amount | Purpose |
|-------|--------|---------|
| **USDT** | ~$0.05 | x402 API payments ($0.001–$0.005 per call) |
| **BNB** | ~$0.02 | Gas for Permit2 approval (~$0.01) + ERC-8004 audit txs |

### How to fund

1. Get a BSC wallet private key (or use an existing one)
2. Send BNB to the wallet address (for gas)
3. Send USDT (BEP-20) to the wallet address (for API payments)
   - BSC USDT contract: [`0x55d398326f99059fF775485246999027B3197955`](https://bscscan.com/address/0x55d398326f99059fF775485246999027B3197955)

> **Note:** The first time you run the demo, Step 1.5 will call `pag0_approve_permit2` to approve the Permit2 contract for USDT spending. This is a one-time on-chain transaction (~$0.01 BNB gas). After approval, all subsequent x402 payments use gasless off-chain Permit2 signatures.

## 3. Create `.env` File

```bash
cp packages/mcp/.env.example packages/mcp/.env
```

Open `packages/mcp/.env` and fill in the values:

```env
# Pag0 Proxy API
PAG0_API_URL=https://pag0-monorepo.fly.dev
PAG0_API_KEY=pag0_live_your_api_key_here       # Key from Step 1 (or skip for auto-register)

# x402 payment network — MUST be "bsc"
NETWORK=bsc

# Wallet mode — MUST be "local" for BSC
WALLET_MODE=local

# BSC wallet private key (with USDT + BNB balance)
WALLET_PRIVATE_KEY=0x...
```

> The script searches for env vars in this order: `packages/mcp/.env` -> `.env` -> `.env.local`

## 4. Install and Build MCP Package

```bash
pnpm install --filter @pag0/mcp... && pnpm -F @pag0/mcp build
```

> This installs only the MCP package and its dependencies — no private submodule access required. If not already built, the demo script will attempt to build automatically.

## 5. Run the Demo

```bash
bash scripts/demo-mcp-agent-bsc.sh
```

### Recording Mode (pause between steps)

```bash
DEMO_PAUSE=1 bash scripts/demo-mcp-agent-bsc.sh
```

Waits for Enter key before each step. Useful for recording demo videos.

## Demo Steps (10 total)

| Step | Feature | MCP Tool |
|------|---------|----------|
| 1 | Wallet status (BSC) | `pag0_wallet_status` |
| 1.5 | Permit2 approval (one-time) | `pag0_approve_permit2` |
| 2 | Budget / policy check | `pag0_check_budget`, `pag0_list_policies` |
| 3 | DeFi API recommendations | `pag0_recommend` |
| 4 | Individual endpoint score | `pag0_score` |
| 5 | x402 payment (Venus rates) | `pag0_request` — $0.001 USDT via Permit2 |
| 6 | x402 payment (PancakeSwap quote) | `pag0_request` — $0.001 USDT via Permit2 |
| 7 | x402 payment (AI token analysis) | `pag0_request` — $0.005 USDT via Permit2 |
| 8 | Spending / cache stats | `pag0_spending`, `pag0_cache_stats` |
| 9 | Transaction history | `pag0_tx_history` |
| 10 | On-chain audit trail (ERC-8004) | `pag0_audit_trail` |

### What Each Step Proves

- **Steps 1–1.5:** AI agent connects to BSC, holds USDT, approves Permit2
- **Steps 2–4:** Spend Firewall enforces budgets; Curation Engine discovers and ranks BSC DeFi APIs
- **Steps 5–7:** Three real x402 payments on BSC via Permit2 (`permitWitnessTransferFrom`)
- **Steps 8–9:** Analytics tracks all spending in USDT (18 decimals), Smart Cache prevents duplicate payments
- **Step 10:** Every payment generates an ERC-8004 on-chain feedback event, verifiable on BSCScan

## Key Differences from Base Sepolia Demo

| Aspect | Base Sepolia (`demo-mcp-agent.sh`) | BSC (`demo-mcp-agent-bsc.sh`) |
|--------|-----------------------------------|-------------------------------|
| Network | Base Sepolia (testnet) | BSC Mainnet (`eip155:56`) |
| Token | USDC (6 decimals) | USDT (18 decimals) |
| Wallet | CDP or Local | Local only |
| Payment | EIP-3009 `transferWithAuthorization` | Permit2 `permitWitnessTransferFrom` |
| Extra step | — | Step 1.5: Permit2 approval |
| APIs | Existing x402 Bazaar endpoints | Self-hosted (Venus, PancakeSwap, AI) |
| Audit | SKALE (zero gas) | BSC (~$0.01/tx) |

## Troubleshooting

### `Proxy not running at ...`

The proxy server is not responding. Verify that `PAG0_API_URL` is correct.

- Production: check `https://pag0-monorepo.fly.dev/health`
- Local (team members only): run `pnpm dev:proxy` first, then retry

### `claude CLI not found`

Claude Code CLI is not installed:

```bash
npm install -g @anthropic-ai/claude-code
```

### Permit2 approval fails

- Check BNB balance: the approval tx costs ~$0.01 BNB gas
- If already approved (Step 1 shows `permit2.approved: true`), the script skips approval

### x402 payment failure

- **USDT balance is 0:** Fund your wallet with BSC USDT (BEP-20)
- **BNB balance is 0:** Fund your wallet with BNB for gas (Permit2 settlement)
- **Permit2 not approved:** Re-run Step 1.5 or manually call `USDT.approve(0x000000000022D473030F116dDEE9F6B43aC78BA3, MAX_UINT256)`

### pnpm install errors with missing submodules

If `pnpm install` fails due to missing `packages/proxy` or `packages/dashboard`, use the filtered install:

```bash
pnpm install --filter @pag0/mcp...
```

This skips the private submodule packages and installs only what the demo needs.

## On-Chain Verification

After running the demo, verify transactions on BSCScan:

- **Permit2 approval:** Search your wallet address → Token Approvals tab
- **USDT payments:** Search your wallet address → BEP-20 Token Txns tab
- **ERC-8004 events:** Check the ReputationRegistry contract → Events tab
  - [`0xeBEf8A66D614ac91dA4397a5d37A1a2daAD240de`](https://bscscan.com/address/0xeBEf8A66D614ac91dA4397a5d37A1a2daAD240de)
