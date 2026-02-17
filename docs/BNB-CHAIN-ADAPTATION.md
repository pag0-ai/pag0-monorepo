# Pag0 → BNB Chain Adaptation Plan

> Porting Pag0 (Smart Proxy Layer for x402) from Base Sepolia to BNB Chain for the **Good Vibes Only: OpenClaw Edition** hackathon.

---

## 1. Executive Summary

### Hackathon

| Item | Detail |
|------|--------|
| Name | [Good Vibes Only: OpenClaw Edition](https://dorahacks.io/hackathon/goodvibes/detail) |
| Prize Pool | $100,000 USD |
| Submission Deadline | 2026-02-19 15:00 UTC (extended to 02-20 00:00 UTC) |
| Onchain Proof | Contract address or tx hash on **BSC** or **opBNB** required |
| Judging | 40% community upvote + 60% judges |

### Positioning

**"The First x402 Smart Proxy on BNB Chain"**

- AEON launched an x402 Facilitator on BNB Chain (Oct 2025), but the x402 Bazaar has **0 APIs registered on BSC**.
- Pag0 brings proven x402 proxy infrastructure (Spend Firewall + API Curation + Smart Cache) to an empty market.
- Every payment through Pag0 on BSC generates on-chain proof — fulfilling the hackathon's core requirement.

### Track Selection

| Track | Fit | Rationale |
|-------|-----|-----------|
| **Builders** (primary) | "Tools that help other developers ship faster" | Pag0 is developer infrastructure — proxy, SDK, MCP server |
| **Agent** (secondary) | "AI agents that execute onchain" | MCP server enables AI agents to discover, pay for, and use APIs on BSC |

---

## 2. Architecture: Current vs BNB Chain

### Current (x402 Hackathon)

```
AI Agent (Claude Code)
    │ MCP Tool Call
    ▼
pag0-mcp (CDP Server Wallet on Base Sepolia)
    │ @x402/fetch → Coinbase Facilitator
    ▼
Pag0 Smart Proxy (Hono + Bun)
    │ relay → x402 APIs on Base Sepolia
    ▼
ERC-8004 Audit → SKALE (zero gas)
    ▼
Subgraph → The Graph (Goldsky)
```

### Target (BNB Chain)

```
AI Agent (Claude Code)
    │ MCP Tool Call
    ▼
pag0-mcp (Local Wallet on BSC)
    │ Permit2 EIP-712 signature (spender = proxy relayer)
    ▼
Pag0 Smart Proxy (Hono + Bun)
    │ Local Permit2 Facilitator: verify + settle
    │ → Permit2.permitWitnessTransferFrom() on BSC
    ▼
Self-hosted x402 APIs on BSC (Venus, PancakeSwap, AI Analysis)
    ▼
ERC-8004 Audit → BSC (low gas, ~$0.01/tx)
    ▼
Subgraph → BSC-compatible indexer (or direct RPC)
```

### Key Infrastructure Changes

| Component | Base Sepolia | BSC |
|-----------|-------------|-----|
| Payment Chain | Base Sepolia (testnet) | BSC Mainnet (`eip155:56`) |
| Facilitator | Coinbase (built-in) | Local Permit2 Facilitator (self-hosted) |
| Authorization | EIP-3009 (transferWithAuthorization) | Permit2 (PermitWitnessTransferFrom) |
| Payment Token | USDC (`0x036CbD53842c5426634e7929541eC2318f3dCF7e`) | USDT (`0x55d398326f99059fF775485246999027B3197955`) |
| Token Decimals | 6 (USDC) | 18 (USDT) |
| Wallet | CDP Server Wallet (Coinbase) | Local ethers wallet (private key) |
| Settlement | Via Coinbase facilitator | Proxy relayer calls Permit2.permitWitnessTransferFrom() |
| Audit Chain | SKALE (zero gas) | BSC (~$0.01/tx) |
| Subgraph | The Graph (Goldsky) | Direct RPC / BSCScan API |
| Explorer | basescan.org | bscscan.com |

---

## 3. Code Change Map

### 3.1 packages/mcp/ (MCP Server)

#### `src/wallet.ts` (L9-16)

Add BSC network configuration:

```typescript
// Current
const USDC_ADDRESSES: Record<string, string> = {
  "base-sepolia": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  "base": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
};
const RPC_URLS: Record<string, string> = {
  "base-sepolia": "https://sepolia.base.org",
  "base": "https://mainnet.base.org",
};

// Add BSC
const TOKEN_ADDRESSES: Record<string, string> = {
  "base-sepolia": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",  // USDC
  "base": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",          // USDC
  "bsc": "0x55d398326f99059fF775485246999027B3197955",             // USDT (BSC)
};
const RPC_URLS: Record<string, string> = {
  "base-sepolia": "https://sepolia.base.org",
  "base": "https://mainnet.base.org",
  "bsc": "https://bsc-dataseed.binance.org",
};
```

Also update `getStatus()` to use "USDT" label when network is BSC (currently hardcoded "USDC").

#### `src/cdp-wallet.ts`

CDP Server Wallet does **not** support BSC. For BNB Chain version:

- **Deprecate** `CdpWallet` — do not use
- Use `Pag0Wallet` (local ethers wallet) exclusively
- Set `WALLET_MODE=local` in env

#### `src/proxy-fetch.ts` (L81-89)

Register BSC scheme with AEON facilitator:

```typescript
// Current
const client = new x402Client()
  .registerV1("base-sepolia", new ExactEvmSchemeV1(signer))
  .registerV1("base", new ExactEvmSchemeV1(signer))
  .register("eip155:84532", new ExactEvmScheme(signer))
  .register("eip155:8453", new ExactEvmScheme(signer));

// BSC version — add BSC schemes
const client = new x402Client()
  .registerV1("base-sepolia", new ExactEvmSchemeV1(signer))
  .registerV1("base", new ExactEvmSchemeV1(signer))
  .register("eip155:84532", new ExactEvmScheme(signer))
  .register("eip155:8453", new ExactEvmScheme(signer))
  .register("eip155:56", new ExactEvmScheme(signer));     // BSC Mainnet
```

**Important**: The `x402Client` needs the AEON facilitator URL. The `wrapFetchWithPayment` may need a custom `facilitatorUrl` option, or the AEON SDK's `HTTPFacilitatorClient` must be configured:

```typescript
import { HTTPFacilitatorClient } from "@x402/core/server";

const facilitatorClient = new HTTPFacilitatorClient({
  url: "https://facilitator.aeon.xyz",
  createAuthHeaders: async () => ({
    verify: { Authorization: `Bearer ${AEON_API_KEY}` },
    settle: { Authorization: `Bearer ${AEON_API_KEY}` },
    supported: { Authorization: `Bearer ${AEON_API_KEY}` },
  }),
});
```

**Note**: Verify whether `@x402/fetch` client-side SDK automatically routes to the AEON facilitator when the server's 402 response includes facilitator info, or if explicit configuration is needed.

#### `src/x402-payment.ts`

**No changes needed** — chain-agnostic. Uses `ExactEvmSchemeV1` which works with any EVM network.

#### `src/index.ts` (L32)

```typescript
// Current
const NETWORK = process.env.NETWORK || "base-sepolia";

// BSC version
const NETWORK = process.env.NETWORK || "bsc";
```

#### `.env`

```env
# Current
NETWORK=base-sepolia

# BSC version
NETWORK=bsc
FACILITATOR_URL=https://facilitator.aeon.xyz
AEON_API_KEY=<obtain from AEON>
WALLET_MODE=local
WALLET_PRIVATE_KEY=<BSC wallet private key>
```

---

### 3.2 packages/proxy/ (Smart Proxy Server)

#### `src/audit/erc8004.ts` (L73-89)

Change environment variable from SKALE-specific to generic:

```typescript
// Current
const rpcUrl = process.env.SKALE_RPC_URL;
if (!signerKey || !reputationAddr || !rpcUrl) {
  console.warn('[ERC-8004] Missing required env vars (...SKALE_RPC_URL). Disabling.');
}

// BSC version
const rpcUrl = process.env.AUDIT_CHAIN_RPC_URL || process.env.SKALE_RPC_URL;
if (!signerKey || !reputationAddr || !rpcUrl) {
  console.warn('[ERC-8004] Missing required env vars (...AUDIT_CHAIN_RPC_URL). Disabling.');
}
```

#### `src/index.ts` (L80-110)

Update hardcoded strings:

```typescript
// L82: description → 'ERC-8004 reputation and validation events on BSC.'
// L90: chain → 'bsc'
// L92: auditChain → 'BSC Mainnet'
// L107: 'Audit trail: ERC-8004 on BSC'
```

#### `src/db/seeds/02_bsc.ts`

BSC seed data is now a TypeScript function in `seeds/02_bsc.ts`. It reads `bsc-x402-apis.json` from the monorepo root and inserts BSC endpoint scores + synthetic requests. The seed is executed automatically as part of `pnpm db:seed` (via `run-seed.ts`).

Create `bsc-x402-apis.json` at monorepo root with self-hosted API entries (see Section 4).

#### `src/subgraph/client.ts`

The subgraph URL is already env-configured (`ERC8004_SUBGRAPH_URL`). Options:

1. Deploy a BSC subgraph (if using The Graph's BSC support)
2. Use direct BSC RPC event queries (simpler for hackathon)
3. Use BSCScan API for event indexing

For hackathon speed, option 2 or 3 is recommended.

#### Other proxy files (NO changes needed)

These are chain-agnostic:

- `src/proxy/relay.ts` — transparent relay
- `src/proxy/x402.ts` — parses network from 402 response dynamically
- `src/proxy/core.ts` — chain info comes from env/DB
- `src/policy/` — entire policy engine
- `src/cache/` — entire cache layer
- `src/analytics/` — entire analytics collector
- `src/curation/engine.ts` — only subgraph URL changes (env-driven)
- `src/middleware/` — auth middleware
- `src/routes/` — API routes

---

### 3.3 packages/contracts/ (Solidity)

#### `src/ReputationRegistry.sol`

**No changes needed.** Pure Solidity, EVM-compatible. Deploy as-is to BSC.

#### `foundry.toml`

```toml
# Add BSC RPC
[rpc_endpoints]
skale = "https://base-sepolia-testnet.skalenodes.com/v1/bite-v2-sandbox"
bsc = "${BSC_RPC_URL}"
bsc-testnet = "https://data-seed-prebsc-1-s1.binance.org:8545"
```

#### Deploy script

```bash
# BSC Testnet (for testing)
forge script script/Deploy.s.sol:Deploy --rpc-url $BSC_TESTNET_RPC_URL --broadcast --verify

# BSC Mainnet
forge script script/Deploy.s.sol:Deploy --rpc-url $BSC_RPC_URL --broadcast --verify
```

#### `deployments.json`

After deployment, update with BSC addresses:

```json
{
  "ReputationRegistry": "<BSC_DEPLOYED_ADDRESS>",
  "ValidationRegistry": "<BSC_DEPLOYED_ADDRESS>"
}
```

---

### 3.4 CRITICAL: Token Decimal Difference (6 → 18)

The entire codebase assumes **USDC with 6 decimals** (`1 USDC = "1000000"`). BSC USDT uses **18 decimals** (`1 USDT = "1000000000000000000"`).

**Affected files and patterns:**

| File | Pattern | Change Needed |
|------|---------|---------------|
| `proxy/src/types/index.ts` | `// USDC: Always BIGINT 6 decimals` | Update comment + type documentation to 18 decimals |
| `mcp/src/client.ts` (L4-5) | `1 USDC = "1000000"` | Change to `1 USDT = "1000000000000000000"` |
| `mcp/src/wallet.ts` (L88) | `formatUnits(balance, 6)` | Change to `formatUnits(balance, 18)` |
| `mcp/src/cdp-wallet.ts` (L109) | `Number(raw) / 1_000_000` | N/A (deprecated for BSC) |
| `dashboard/app/dashboard/page.tsx` (L37,89,90) | `Number(amount) / 1_000_000` | Change to `/ 1e18` or use `formatUnits(amount, 18)` |
| `dashboard/app/policies/page.tsx` (L18,22) | `* 1_000_000` and `/ 1_000_000` | Change to `* 1e18` and `/ 1e18` |
| `proxy/src/policy/budget.ts` (L62) | `1 USDC = "1000000"` | Update to 18 decimals |
| `mcp/src/tools/wallet.ts` (L10) | description mentions "USDC" | Change to "USDT" |
| `mcp/src/tools/policy.ts` (L41) | `"USDC (6 decimals)"` | Change to `"USDT (18 decimals)"` |
| `mcp/src/tools/wallet-fund.ts` (L11) | `"Base Sepolia only"` | Disable or remove for BSC |
| `proxy/src/db/seeds/01_base-sepolia.ts` | Budget amounts in 6-decimal format | Recalculate for 18 decimals |

**Approach options:**

1. **Use env-driven decimals** — add `TOKEN_DECIMALS=18` env var, use throughout
2. **Hardcode 18** — simpler for hackathon, less flexible
3. **Use BSC USDC instead** — `0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d` (also 18 decimals on BSC, same issue)

**Recommendation**: Option 1 for clean code, with a helper function:

```typescript
const TOKEN_DECIMALS = Number(process.env.TOKEN_DECIMALS || "18");
const ONE_TOKEN = BigInt(10) ** BigInt(TOKEN_DECIMALS);

function formatTokenAmount(raw: string): string {
  return (Number(raw) / Number(ONE_TOKEN)).toFixed(4);
}
```

**Note**: The x402 SDK's `paymentMiddleware` with `price: "$0.001"` should handle decimal conversion internally based on the token contract. Verify this during implementation.

### 3.5 packages/dashboard/ (Next.js Frontend)

- `app/dashboard/page.tsx` (L37,89,90,292): Change `/ 1_000_000` → use decimal helper; change `'USDC'` → `'USDT'`
- `app/policies/page.tsx` (L18,22): Change `* 1_000_000` and `/ 1_000_000` → use decimal helper
- Update explorer URL from `basescan.org` to `bscscan.com`
- Change network label from "Base Sepolia" to "BSC"

### 3.6 Additional MCP Tool Files

| File | Change |
|------|--------|
| `mcp/src/tools/wallet.ts` (L10) | Update description: "USDC balance" → "USDT balance" |
| `mcp/src/tools/wallet-fund.ts` (L11) | Disable or note "BSC has no faucet — fund wallet manually" |
| `mcp/src/tools/policy.ts` (L41) | Update: `"USDC (6 decimals)"` → `"USDT (18 decimals)"` |
| `mcp/test-tools.ts` (L31) | Update default network to `bsc` |

---

### 3.5 Root Files

#### `.env.local` (monorepo root)

```env
# Payment network
NETWORK=bsc
X402_NETWORK=bsc

# AEON Facilitator
FACILITATOR_URL=https://facilitator.aeon.xyz
AEON_API_KEY=<obtain from AEON>

# Wallet (local mode, no CDP)
WALLET_MODE=local
WALLET_PRIVATE_KEY=<BSC wallet private key with USDT balance>

# ERC-8004 Audit (now on BSC instead of SKALE)
AUDIT_CHAIN_RPC_URL=https://bsc-dataseed.binance.org
ERC8004_SIGNER_KEY=<same as WALLET_PRIVATE_KEY or separate>
ERC8004_REPUTATION_REGISTRY=<BSC deployed address>
ERC8004_VALIDATION_REGISTRY=<BSC deployed address>
ERC8004_ENABLED=true
```

---

## 4. Self-Hosted x402 Demo APIs on BSC

Since the x402 Bazaar has 0 APIs on BSC, Pag0 will self-host demo APIs using AEON's x402 middleware.

### API Design

| Endpoint | Method | Price | Description | Data Source |
|----------|--------|-------|-------------|-------------|
| `/bsc/defi/venus/rates` | GET | $0.001 | Venus Protocol lending rates (supply APY, borrow APY per market) | Venus `vToken` contract reads on BSC |
| `/bsc/defi/pancake/quote` | GET | $0.001 | PancakeSwap swap quote (best route, price impact, output amount) | PancakeSwap Smart Router on BSC |
| `/bsc/ai/analyze-token` | POST | $0.005 | AI-powered token analysis (risk factors, holder distribution, liquidity depth) | OpenAI API + BSCScan API |
| `/bsc/ai/risk-score` | POST | $0.005 | DeFi protocol risk score (A+ to D rating with reasoning) | OpenAI API + on-chain data |

### Implementation

Using x402 Hono middleware with a **local Permit2 facilitator** (AEON's facilitator doesn't support Permit2):

```typescript
import { paymentMiddleware, x402ResourceServer } from "@x402/hono";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { LocalBscFacilitatorClient } from "./bsc-facilitator";

// Local facilitator: verifies Permit2 EIP-712 signatures + settles via on-chain Permit2
const facilitatorClient = new LocalBscFacilitatorClient(
  payToAddress,           // where USDT goes
  payToPrivateKey,        // proxy's private key (payTo derived, also used as relayer for on-chain tx)
);

const resourceServer = new x402ResourceServer(facilitatorClient)
  .register("eip155:56", new ExactEvmScheme());

// Route config with explicit Permit2 asset
const bscAsset = (dollars: string) => ({
  amount: usdtAmount(dollars),
  asset: "0x55d398326f99059fF775485246999027B3197955", // BSC USDT
  extra: {
    name: "Tether USD", version: "1",
    assetTransferMethod: "permit2",
    spender: relayerAddress,  // proxy relayer = Permit2 spender
  },
});

app.use(paymentMiddleware({
  "GET /bsc/defi/venus/rates": {
    accepts: [{ scheme: "exact", price: bscAsset("$0.001"), network: "eip155:56", payTo: payToAddress }],
    description: "Venus Protocol lending rates on BSC",
    mimeType: "application/json",
  },
  // ... more routes
}, resourceServer));
```

### Venus Protocol Data Fetching

```typescript
// Venus vToken ABI (minimal)
const vTokenABI = [
  "function supplyRatePerBlock() view returns (uint256)",
  "function borrowRatePerBlock() view returns (uint256)",
  "function getCash() view returns (uint256)",
  "function totalBorrows() view returns (uint256)",
];

// Venus Core Pool markets on BSC
const VENUS_MARKETS = {
  vUSDT: "0xfD5840Cd36d94D7229439859C0112a4185BC0255",
  vBUSD: "0x95c78222B3D6e262dCeD22886E1ab8F4E76768FF",
  vBNB:  "0xA07c5b74C9B40447a954e1466938b865b6BBea36",
  vETH:  "0xf508fCD89b8bd15579dc79A6827cB4686A3592c8",
};
```

### PancakeSwap Quote

```typescript
// PancakeSwap V3 Smart Router on BSC
const PANCAKE_ROUTER = "0x13f4EA83D0bd40E75C8222255bc855a974568Dd4";
// Or use PancakeSwap API: https://router-api.pancakeswap.com/v0/quote
```

---

## 5. Permit2 x402 Integration Details

### Why Permit2 (not EIP-3009 or AEON)

BSC USDT does **not** support EIP-3009 (`transferWithAuthorization`). No BSC stablecoin (USDT, USDC, FDUSD, TUSD, DAI) supports it — they're all basic BEP-20 bridge wrappers without `permit` or `DOMAIN_SEPARATOR`.

AEON's facilitator crashes with 500 on Permit2 payloads (tries to read EIP-3009 fields that don't exist).

**Solution**: Local Permit2 Facilitator using Uniswap's universal Permit2 contract (`0x000000000022D473030F116dDEE9F6B43aC78BA3`), already deployed on BSC.

### Protocol Flow on BSC

```
1. Client → Proxy: GET /bsc/defi/venus/rates
2. Proxy → Client: 402 Payment Required
   {
     "accepts": [{
       "scheme": "exact",
       "network": "eip155:56",
       "amount": "1000000000000000",
       "asset": "0x55d398326f99059fF775485246999027B3197955",
       "payTo": "0x...",
       "extra": { "name": "Tether USD", "version": "1", "assetTransferMethod": "permit2", "spender": "0xRelayerAddress" }
     }]
   }
3. Client: Sign Permit2 EIP-712 typed data (spender = proxy relayer address)
4. Client → Proxy: Retry with PAYMENT-SIGNATURE header (base64 payload)
5. Proxy (LocalBscFacilitatorClient): verify — recover signer, check amounts/token/payTo/deadline
6. Proxy (LocalBscFacilitatorClient): settle — call Permit2.permitWitnessTransferFrom() on BSC
7. Permit2 → BSC: On-chain USDT transfer (user → payTo)
8. Proxy → Client: 200 OK + data + tx_hash
```

### Permit2 Pre-requisite

One-time ERC-20 approval: user calls `USDT.approve(PERMIT2_ADDRESS, MAX_UINT256)` (~$0.01 BNB gas).

The MCP server provides `pag0_approve_permit2` tool for this. After approval, all subsequent x402 payments use gasless off-chain Permit2 signatures.

### Key Addresses

| Contract | Address |
|----------|---------|
| Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |
| BSC USDT | `0x55d398326f99059fF775485246999027B3197955` |
| x402 SDK packages | `@x402/hono`, `@x402/fetch`, `@x402/evm`, `@x402/core` |

---

## 6. Onchain Proof Plan

Hackathon requirement: **"Contract address or tx hash on BSC or opBNB"**

### Deployment Transactions

| # | Transaction | Chain | Purpose |
|---|-------------|-------|---------|
| 1 | Deploy `ReputationRegistry` | BSC Mainnet | On-chain audit trail for API quality |
| 2 | Deploy `ValidationRegistry` | BSC Mainnet | Pre-validation for high-cost txs |
| 3 | `giveFeedback()` call | BSC Mainnet | Record first API quality feedback |

### x402 Payment Transactions

| # | Transaction | Chain | Purpose |
|---|-------------|-------|---------|
| 4 | USDT `approve(Permit2)` | BSC Mainnet | One-time Permit2 approval for USDT |
| 5 | `permitWitnessTransferFrom` for Venus rates | BSC Mainnet | First x402 payment on BSC via Pag0 |
| 6 | `permitWitnessTransferFrom` for token analysis | BSC Mainnet | AI Agent paying for API on BSC |

### Required BSC Resources

- **Wallet**: BSC address with ~$1 USDT + ~$0.5 BNB (for gas)
- **Gas costs**: ~$0.01 per contract deployment, ~$0.005 per tx
- **Total estimated cost**: < $2

---

## 7. Demo Scenario (2-3 min video)

### Scene 1: Setup (30s)

- Show Pag0 dashboard on BSC (network: BSC, token: USDT)
- Show AI Agent (Claude Code) with Pag0 MCP tools

### Scene 2: API Discovery (30s)

- AI Agent: "What BNB Chain DeFi APIs are available?"
- Pag0 MCP → `pag0_recommend_apis` → Shows Venus rates, PancakeSwap quotes ranked by score

### Scene 3: x402 Payment on BSC (45s)

- AI Agent: "Get current Venus lending rates"
- Pag0 MCP → relay → 402 → USDT payment via AEON → 200 OK
- Show BSCScan tx: USDT transferred on BSC
- Show Pag0 dashboard: budget updated, API score refreshed

### Scene 4: Smart Features (30s)

- Show spend firewall blocking over-budget request
- Show smart cache saving duplicate payment
- Show curation engine ranking APIs by quality

### Scene 5: On-chain Audit (15s)

- Show ReputationRegistry on BSCScan
- Show `FeedbackGiven` events with quality scores

---

## 8. Submission Checklist

### Required

- [ ] GitHub Repository (public) — fork or new repo with BSC config
- [ ] Contract addresses on BSC (ReputationRegistry, ValidationRegistry)
- [ ] Transaction hashes on BSC (deployment + x402 payments)
- [ ] Demo Video (2-3 min, uploaded to YouTube)
- [ ] Live Demo URL (Vercel dashboard + Fly.io proxy)
- [ ] Reproduction instructions in README

### Bonus

- [ ] AI Build Log (`AI-BUILD-LOG.md` with Claude Code usage evidence)
- [ ] Git commits tagged with `[AI]`

---

## 9. Risk & Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Permit2 on-chain settle fails (gas, nonce) | Medium | Medium | Fallback: verify-only mode (signature verified, settlement logged) |
| BSC USDT Permit2 approve adds UX friction | Low | Low | One-time max approval via pag0_approve_permit2 tool; documented in demo |
| Gas costs on BSC for audit trail | Low | Low | ~$0.01/tx, negligible vs SKALE zero-gas |
| x402 SDK Permit2 spender mismatch | Low | Medium | Manual Permit2 payload creation bypasses SDK's hardcoded spender |
| Time constraint (2 days) | High | High | Prioritize: contracts deploy > MCP wallet > demo APIs > video |

---

## 10. Priority Order (2-Day Sprint)

### Day 1: Infrastructure

1. **Deploy contracts to BSC** (30 min) — `forge script` with BSC RPC
2. **Update wallet.ts** for BSC (30 min) — add BSC network config
3. **Update proxy-fetch.ts** for BSC (1 hr) — register `eip155:56`, AEON facilitator
4. **Create demo x402 API server** (3 hr) — Venus rates + PancakeSwap quotes with AEON middleware
5. **Test E2E payment flow** (2 hr) — MCP → proxy → demo API → AEON → BSC tx

### Day 2: Polish & Submit

1. **Update proxy env & seed data** (1 hr) — BSC config, `bsc-x402-apis.json`
2. **Update dashboard** (1 hr) — BSCScan links, BSC network label
3. **Record demo video** (2 hr) — 3 scenes, screen recording
4. **Write AI Build Log** (30 min) — document AI usage
5. **Submit to DoraHacks** (30 min) — repo, video, contract addresses

---

## References

- **Uniswap Permit2**: <https://github.com/Uniswap/permit2>
- **Permit2 on BSC**: `0x000000000022D473030F116dDEE9F6B43aC78BA3`
- **BSC USDT Contract**: `0x55d398326f99059fF775485246999027B3197955`
- **x402 Protocol SDK**: `@x402/hono`, `@x402/evm`, `@x402/core`, `@x402/fetch`
- **Venus Protocol (BSC)**: <https://venus.io/>
- **PancakeSwap Router API**: <https://router-api.pancakeswap.com>
- **Hackathon Page**: <https://dorahacks.io/hackathon/goodvibes/detail>
- **AEON x402 Launch PR**: <https://www.prnewswire.com/news-releases/aeon-launches-x402-facilitator-on-bnb-chain-advancing-real-world-autonomous-ai-payments-302599547.html>
- **BNB Chain Developers on x402**: <https://x.com/BNBChainDevs/status/1983198549039780026>
