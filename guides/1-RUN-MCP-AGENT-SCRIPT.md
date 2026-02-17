# MCP Agent Demo Script Guide

`scripts/demo-mcp-agent.sh` is an E2E demo script that automatically runs 10 Pag0 MCP tools via the Claude Code CLI.

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

## 2. Wallet Setup

Choose one of the two wallet modes.

### Option A: CDP Wallet (Recommended)

Uses a Coinbase Developer Platform Server Wallet. Includes auto-faucet so no manual USDC funding is needed.

Create API keys at [CDP Portal](https://portal.cdp.coinbase.com/):

- `CDP_API_KEY_ID`
- `CDP_API_KEY_SECRET`
- `CDP_WALLET_SECRET`

### Option B: Local Wallet

Uses ethers.Wallet. The script auto-generates a temporary key, but you need Base Sepolia testnet USDC.

- USDC contract: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
- Get ETH from [Base Sepolia Faucet](https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet), then swap for USDC

## 3. Create `.env` File

```bash
cp packages/mcp/.env.example packages/mcp/.env
```

Open `packages/mcp/.env` and fill in the values:

```env
# Pag0 Proxy API
PAG0_API_URL=https://pag0-monorepo.fly.dev
PAG0_API_KEY=pag0_live_your_api_key_here       # Key from Step 1

# x402 payment network
NETWORK=base-sepolia

# Wallet mode: "local" (ethers.Wallet) or "cdp" (Coinbase Server Wallet)
WALLET_MODE=cdp

# CDP Wallet (required if WALLET_MODE=cdp)
CDP_API_KEY_ID=your_cdp_key_id
CDP_API_KEY_SECRET=your_cdp_key_secret
CDP_WALLET_SECRET=your_cdp_wallet_secret

# Local Wallet (optional if WALLET_MODE=local, script auto-generates)
# WALLET_PRIVATE_KEY=0x...
```

> The script searches for env vars in this order: `packages/mcp/.env` -> `.env` -> `.env.local`

## 4. Install and Build MCP Package

```bash
pnpm install --filter @pag0/mcp... && pnpm -F @pag0/mcp build
```

> This installs only the MCP package and its dependencies — no private submodule access required. If not already built, the demo script will attempt to build automatically.

## 5. Run the Demo

```bash
bash scripts/demo-mcp-agent.sh
```

### Recording Mode (pause between steps)

```bash
DEMO_PAUSE=1 bash scripts/demo-mcp-agent.sh
```

Waits for Enter key before each step. Useful for recording demo videos.

## Demo Steps (10 total)

| Step | Feature | MCP Tool |
|------|---------|----------|
| 4.1 | Wallet status check | `pag0_wallet_status` |
| 4.2 | Budget / policy check | `pag0_check_budget`, `pag0_list_policies` |
| 4.3 | API recommendations | `pag0_recommend` |
| 4.4 | Endpoint comparison | `pag0_compare` |
| 4.5 | x402 payment (Math API) | `pag0_score`, `pag0_request` |
| 4.6 | x402 payment (Motivate API) | `pag0_score`, `pag0_request` |
| 4.7 | Spending / cache stats | `pag0_spending`, `pag0_cache_stats` |
| 4.8 | Endpoint detailed score | `pag0_score` |
| 4.9 | Transaction history | `pag0_tx_history` |
| 4.10 | On-chain audit trail | `pag0_audit_trail` |

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

### CDP credentials incomplete

If any of the 3 CDP keys (`CDP_API_KEY_ID`, `CDP_API_KEY_SECRET`, `CDP_WALLET_SECRET`) are missing, the script automatically falls back to local wallet mode. Set all 3 in `.env` to use CDP.

### x402 payment failure

- Check USDC balance: if balance is 0 in Step 4.1, you need to fund the wallet
- CDP mode: `cdp.evm.requestFaucet()` runs automatically, but may fail if already claimed
- Local mode: you must fund Base Sepolia USDC manually

### pnpm install errors with missing submodules

If `pnpm install` fails due to missing `packages/proxy` or `packages/dashboard`, use the filtered install:

```bash
pnpm install --filter @pag0/mcp...
```

This skips the private submodule packages and installs only what the demo needs.
