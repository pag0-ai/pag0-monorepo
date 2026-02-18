# Pag0 on BNB Chain — The First x402 Smart Proxy on BSC

> **One-liner:** Pag0 brings the x402 payment protocol to BNB Chain — enabling AI agents to **discover, pay for, and manage** DeFi APIs on BSC through a single smart proxy with **spend control**, **API curation**, and **Permit2-based payments**.

**Quick Links**

- **Demo Video (YouTube):** <https://youtu.be/Du7mqZNaY4c>
- **Demo Setup & Run Guide:** [`guides/2-RUN-MCP-AGENT-BSC.md`](guides/2-RUN-MCP-AGENT-BSC.md)
- **Track:** Builders (primary) / Agent (secondary)

---

## The Opportunity

AEON launched an x402 Facilitator on BNB Chain (Oct 2025). But the **x402 Bazaar has 0 APIs registered on BSC.** The infrastructure exists — no one is using it.

| Gap | What's Missing |
|-----|---------------|
| **No APIs** | Zero x402-enabled APIs on BNB Chain — nothing for agents to pay for |
| **No Permit2 support** | BSC tokens (USDT, USDC) lack EIP-3009; AEON's facilitator crashes on Permit2 payloads |
| **No agent tooling** | No MCP server, no budget control, no curation — just a raw facilitator |

Pag0 fills the entire stack: **APIs + Facilitator + Proxy + Agent Tools** — all on BSC.

---

## What We Built: x402 on BSC, End-to-End

```
AI Agent (Claude Code)
    │ MCP Tool Call
    ▼
pag0-mcp (Local Wallet on BSC)
    │ Permit2 EIP-712 signature (gasless for user)
    ▼
Pag0 Smart Proxy (Hono + Bun)
    ├─ Spend Firewall ─ Policy Engine ─ Smart Cache
    │ Local Permit2 Facilitator: verify + settle on-chain
    ▼
Self-hosted x402 APIs (Venus, PancakeSwap, AI Analysis)
    ▼
ERC-8004 Audit Trail on BSC (verifiable on BSCScan)
```

### Core Innovation: Local Permit2 Facilitator

BSC USDT is a basic BEP-20 bridge token — **no `permit()`, no `transferWithAuthorization()`, no EIP-3009.** AEON's facilitator crashes trying to read these non-existent fields.

**Our solution:** `LocalBscFacilitatorClient` — a self-hosted x402 facilitator that verifies Permit2 EIP-712 signatures and settles payments on-chain via Uniswap's universal [Permit2 contract](https://github.com/Uniswap/permit2) (`0x000...22D473`), already deployed on BSC.

```
Payment Flow:
1. Agent requests API         → Proxy returns 402 (USDT price + Permit2 metadata)
2. Agent signs Permit2 EIP-712 → Off-chain, gasless for the agent
3. Proxy verifies signature    → Recovers signer, checks amount/token/deadline
4. Proxy settles on-chain     → Permit2.permitWitnessTransferFrom() on BSC
5. USDT transferred           → Agent receives API response + on-chain receipt
```

One-time setup: `USDT.approve(Permit2, MAX)` (~$0.01 BNB gas). After that, **all payments are gasless off-chain signatures.**

---

## Self-Hosted x402 APIs on BSC

Since the x402 Bazaar has 0 BSC APIs, we built and hosted our own:

| Endpoint | Method | Price | Description |
|----------|--------|-------|-------------|
| `/bsc/defi/venus/rates` | GET | $0.001 | Venus Protocol real-time lending rates (supply/borrow APY) |
| `/bsc/defi/pancake/quote` | GET | $0.001 | PancakeSwap optimal swap route and price quote |
| `/bsc/ai/analyze-token` | POST | $0.005 | AI-powered BSC token risk analysis |

All endpoints accept USDT payments via Permit2 on BSC Mainnet (`eip155:56`).

---

## Working Demo (10/10 Steps Passed)

A fully functional MCP server lets any AI agent use Pag0 tools on BNB Chain natively:

| Step | What It Shows | Result |
|------|--------------|--------|
| **1. Wallet Setup** | Local wallet on BSC with USDT balance | BSC Mainnet, eip155:56 |
| **1.5. Permit2 Approval** | One-time on-chain USDT approval | Tx hash on BSCScan |
| **2. Health Check** | Budget & policy enforcement for BSC | Daily/monthly limits in USDT (18 decimals) |
| **3. DeFi Recommendations** | Curation engine discovers BSC APIs | Venus, PancakeSwap, AI Analysis ranked by score |
| **4. Endpoint Score** | Quality scoring with 4 dimensions | Cost, latency, reliability, reputation breakdown |
| **5. x402 Payment (Venus)** | Real Permit2 payment on BSC | $0.001 USDT paid, 200 OK, lending rates returned |
| **6. x402 Payment (PancakeSwap)** | Second Permit2 payment | $0.001 USDT, swap quote with optimal route |
| **7. x402 Payment (AI Analysis)** | Higher-cost API call | $0.005 USDT, token risk analysis with AI |
| **8. Accounting** | Real-time spend tracking | Total USDT spent, cache savings, budget remaining |
| **9. Tx History** | Full audit trail | All transactions on chain_id: 56 with latency/cost |
| **10. On-Chain Audit** | ERC-8004 feedback on BSC | Quality scores + tx hashes verifiable on BSCScan |

---

## Architecture: Base Sepolia vs BNB Chain

| Component | Base Sepolia (x402 Hackathon) | BNB Chain (This Build) |
|-----------|------------------------------|------------------------|
| **Payment Chain** | Base Sepolia (testnet) | BSC Mainnet (`eip155:56`) |
| **Token** | USDC (6 decimals) | USDT (18 decimals) |
| **Payment Auth** | EIP-3009 `transferWithAuthorization` | **Permit2** `permitWitnessTransferFrom` |
| **Facilitator** | Coinbase (external) | **LocalBscFacilitatorClient** (self-hosted) |
| **Wallet** | CDP Server Wallet (Coinbase) | Local ethers.Wallet |
| **Settlement** | Coinbase facilitator (async) | Proxy relayer settles on-chain (sync) |
| **x402 APIs** | Existing Bazaar endpoints | Self-hosted (Venus, PancakeSwap, AI) |
| **Audit Chain** | SKALE (zero gas) | BSC (~$0.01/tx) |
| **Explorer** | basescan.org | bscscan.com |

**What stays the same:** Spend Firewall, API Curation Engine, Smart Cache, Analytics Collector, 16 MCP Tools, Dashboard — all chain-agnostic.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Proxy Runtime** | Hono + Bun |
| **Wallet** | Local ethers.Wallet (BSC) |
| **x402 Payments** | `@x402/fetch` SDK + custom `BscPermit2Scheme` |
| **Facilitator** | `LocalBscFacilitatorClient` (Permit2 verify + on-chain settle) |
| **Payment Token** | BSC USDT (`0x55d398...7B3197955`) via Permit2 (`0x000...22D473`) |
| **On-Chain Audit** | ERC-8004 ReputationRegistry on BSC |
| **Cache** | Redis (Upstash / ioredis) |
| **Database** | PostgreSQL (Supabase) |
| **Dashboard** | Next.js + Tailwind + Recharts |
| **Deployment** | Fly.io (backend) + Vercel (frontend) |

---

## On-Chain Proof (BSC Mainnet)

Hackathon requirement: *"Contract address or tx hash on BSC or opBNB"*

| # | Transaction | Purpose |
|---|-------------|---------|
| 1 | Deploy `ReputationRegistry` | ERC-8004 audit trail contract |
| 2 | Deploy `ValidationRegistry` | Pre-validation registry |
| 3 | `USDT.approve(Permit2, MAX)` | One-time Permit2 approval |
| 4 | `permitWitnessTransferFrom` (Venus) | x402 payment for DeFi data |
| 5 | `permitWitnessTransferFrom` (PancakeSwap) | x402 payment for swap quote |
| 6 | `permitWitnessTransferFrom` (AI Analysis) | x402 payment for token analysis |
| 7 | `giveFeedback()` on ReputationRegistry | On-chain API quality feedback |

**Total cost:** < $2 (BSC gas ~$0.01/tx + API payments in USDT)

---

## Market Opportunity

- **Empty market:** x402 Bazaar has 0 APIs on BSC. Pag0 is the first to bring x402 infrastructure + APIs to BNB Chain.
- **BSC DeFi ecosystem:** $5B+ TVL across Venus, PancakeSwap, Alpaca Finance — massive demand for paid API access.
- **Permit2 is universal:** Uniswap's Permit2 is deployed on 20+ chains. The `LocalBscFacilitatorClient` pattern extends x402 to any EVM chain where tokens lack EIP-3009.
- **Data network effect:** Every API call through Pag0 feeds the curation engine. More usage = better recommendations = more usage.

---

## What We Built

- **Custom Permit2 Facilitator** — `LocalBscFacilitatorClient` with EIP-712 signature verification + on-chain settlement
- **`BscPermit2Scheme`** — x402 client scheme that reads dynamic `spender` from 402 response (fixes SDK's hardcoded address)
- **3 self-hosted x402 APIs** — Venus rates, PancakeSwap quotes, AI token analysis (all on BSC)
- **BSC seed data** — Endpoint scores, policies, synthetic requests with 18-decimal USDT amounts
- **10-step demo script** — Fully automated, proves end-to-end x402 payments on BSC
- **Multi-chain proxy** — Same proxy supports Base Sepolia (USDC/EIP-3009) and BSC (USDT/Permit2) simultaneously via `chain_id`

---

## Links

- **Demo Video (YouTube):** <https://youtu.be/Du7mqZNaY4c>
- **GitHub:** <https://github.com/pag0-ai/pag0-monorepo>
- **Dashboard:** <https://pag0-demo-dashboard.vercel.app>
- **API:** <https://pag0-monorepo.fly.dev>
- **Hackathon:** <https://dorahacks.io/hackathon/goodvibes/detail>
- **EOA (BSC):**
  - x402 payTo: [0xe1f84d0944B6C88e393171218B0148781ff5ef51](https://bscscan.com/address/0xe1f84d0944B6C88e393171218B0148781ff5ef51)
- **Contracts (BSC):**
  - ReputationRegistry: [`0xeBEf8A66D614ac91dA4397a5d37A1a2daAD240de`](https://bscscan.com/address/0xeBEf8A66D614ac91dA4397a5d37A1a2daAD240de)
  - ValidationRegistry: [`0x719dBB83664Ad25091CB91b0a39BF52BD7685c0A`](https://bscscan.com/address/0x719dBB83664Ad25091CB91b0a39BF52BD7685c0A)
- **Key BSC Addresses:**
  - Permit2: [`0x000000000022D473030F116dDEE9F6B43aC78BA3`](https://bscscan.com/address/0x000000000022D473030F116dDEE9F6B43aC78BA3)
  - BSC USDT: [`0x55d398326f99059fF775485246999027B3197955`](https://bscscan.com/address/0x55d398326f99059fF775485246999027B3197955)
