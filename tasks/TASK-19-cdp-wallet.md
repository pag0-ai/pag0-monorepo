# TASK-19: CDP Wallet Integration (Coinbase Server Wallet)

| Item | Details |
|------|------|
| **Package** | `packages/mcp` |
| **Estimated Time** | 2~3 hours |
| **Status** | ✅ **Complete** |
| **Dependencies** | [TASK-16](./TASK-16-mcp-integration.md) (MCP server complete) |
| **Blocks** | TASK-20 (use wallet address in ERC-8004), TASK-21 (MCP tool expansion) |
| **Reference Docs** | `docs/03-TECH-SPEC.md` §3.2, `docs/12-SDK-GUIDE.md` §1.6 |

## Objective

Replace current `ethers.Wallet`-based local key management with **Coinbase CDP Server Wallet** to enable AI Agents to securely perform payment signatures within Coinbase infrastructure without key exposure.

## Implementation Results

### Architecture: Dual Wallet Mode (`WALLET_MODE=local|cdp`)

Integrate existing `ethers.Wallet` mode with new CDP Server Wallet mode via `IWallet` interface to maintain backward compatibility.

```
WALLET_MODE=local (default)     WALLET_MODE=cdp
  ┌──────────────┐              ┌──────────────┐
  │  Pag0Wallet  │              │  CdpWallet   │
  │ (ethers.Wallet)│            │ (@coinbase/  │
  │              │              │  cdp-sdk)    │
  └──────┬───────┘              └──────┬───────┘
         │                             │
         └──────────┬──────────────────┘
                    │
             ┌──────┴──────┐
             │  IWallet    │
             │  interface  │
             └─────────────┘
```

### Changed Files

| File | Action | Description |
|------|------|------|
| `src/cdp-wallet.ts` | **New** | `CdpWallet` class — `@coinbase/cdp-sdk` CdpClient wrapper. `getStatus()`, `signPayment()`, `requestFaucet()` |
| `src/wallet.ts` | **Modified** | Added `IWallet` interface, added `walletMode` property to `Pag0Wallet` |
| `src/index.ts` | **Modified** | Wallet selection logic based on `WALLET_MODE` env var, `CdpWallet` import + `init()` |
| `src/tools/wallet.ts` | **Modified** | Use `IWallet` type, include `walletMode` in response |
| `src/tools/wallet-fund.ts` | **New** | `pag0_wallet_fund` MCP tool (CDP mode only testnet faucet) |
| `src/tools/proxy.ts` | **Modified** | wallet parameter `Pag0Wallet` → `IWallet` |
| `src/tools/smart.ts` | **Modified** | wallet parameter `Pag0Wallet` → `IWallet` |
| `.env.example` | **Modified** | Added `WALLET_MODE`, `CDP_API_KEY_ID`, `CDP_API_KEY_SECRET`, `CDP_WALLET_SECRET` |
| `package.json` | **Modified** | Added `@coinbase/cdp-sdk ^1.44.0` dependency |

### MCP Tools (12 total → existing 11 + new 1)

- `pag0_wallet_status` — Wallet address, USDC balance, network + **walletMode** displayed
- `pag0_wallet_fund` **(New)** — Base Sepolia testnet USDC faucet request (CDP mode only)

### Environment Variables

```env
# Wallet mode: "local" (ethers.Wallet) or "cdp" (Coinbase Server Wallet)
WALLET_MODE=local

# CDP Wallet (required if WALLET_MODE=cdp)
CDP_API_KEY_ID=
CDP_API_KEY_SECRET=
CDP_WALLET_SECRET=
```

## Security Considerations

| Item | Design |
|------|------|
| Key Management | Coinbase Server Wallet — keys managed in Coinbase infrastructure, Pag0 only holds API Key |
| Signing Authority | Only pag0-mcp can request signatures, no key exposure to AI Agent itself |
| Spending Limits | Only requests that pass Policy Engine budget validation proceed to signing |
| Audit Trail | All signatures/payments logged to Analytics Collector |

## Fallback Strategy

- CDP SDK integration failure: `WALLET_MODE=local` (default) maintains existing `ethers.Wallet`
- CDP API outage: Return error message

## Completion Criteria

- [x] `CdpWallet` class implementation (`cdp-wallet.ts`) — complies with `IWallet` interface
- [x] `@coinbase/cdp-sdk ^1.44.0` package installed and TypeScript strict build passes
- [x] `WALLET_MODE=local|cdp` switching support (default `local`, backward compatible)
- [x] `pag0_wallet_status` tool returns including `walletMode`
- [x] `pag0_wallet_fund` tool implemented (CDP mode, Base Sepolia only)
- [x] 402 → CDP `signPayment()` → retry flow (operates via IWallet interface)
- [x] `.env.example` updated
