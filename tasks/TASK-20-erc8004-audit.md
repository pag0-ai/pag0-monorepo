# TASK-20: ERC-8004 Audit Trail Integration

| Item | Details |
|------|------|
| **Package** | `packages/proxy` (main) |
| **Estimated Time** | 3~4 hours |
| **Dependencies** | [TASK-05](./TASK-05-proxy-core.md) (ProxyCore Post-Processing), [TASK-19](./TASK-19-cdp-wallet.md) (CDP Wallet address) |
| **Blocks** | TASK-21 (MCP audit tools), TASK-23 (The Graph subgraph) |
| **Reference Docs** | `docs/03-TECH-SPEC.md` §3.4, `docs/01-PRODUCT-BRIEF.md` Core Features table |

## Objective

After x402 payment completion, automatically write **on-chain audit records** to the ERC-8004 ReputationRegistry. Upload metadata (proofOfPayment + serviceMetrics) to IPFS and provide trustless audit trail via `giveFeedback()` calls.

## Current State

- ProxyCore Post-Processing Pipeline: Cache Store + Analytics Log + Budget Update (3 stages)
- No ERC-8004 integration
- SKALE Integration (`proxy/src/skale/`) exists (can reference on-chain metrics recording patterns)

## Implementation Items

### 1. Create ERC8004AuditTrail Class

Create `packages/proxy/src/audit/erc8004.ts`:

```typescript
class ERC8004AuditTrail {
  // Record feedback to ReputationRegistry after x402 payment completion
  async recordPaymentFeedback(params: {
    agentId: string;        // ERC-8004 ID of x402 server
    endpoint: string;
    cost: string;           // USDC BIGINT string
    latencyMs: number;
    statusCode: number;
    txHash: string;         // x402 payment transaction hash
    sender: string;         // CDP Wallet address
    receiver: string;       // x402 server address
  }): Promise<string>;      // On-chain tx hash

  // Request validation from ValidationRegistry for high-value payments
  async requestValidation(params: {
    agentId: string;
    endpoint: string;
    estimatedCost: string;
    taskDescription: string;
  }): Promise<string>;
}
```

### 2. IPFS Metadata Upload

feedbackURI JSON structure:
```json
{
  "version": "1.0",
  "type": "x402-payment-audit",
  "proofOfPayment": {
    "txHash": "0x...",
    "sender": "0x...",
    "receiver": "0x...",
    "amount": "50000",
    "network": "base"
  },
  "serviceMetrics": {
    "endpoint": "api.openai.com",
    "latencyMs": 234,
    "statusCode": 200,
    "timestamp": 1234567890
  }
}
```

### 3. Extend ProxyCore Post-Processing

Modify `packages/proxy/src/proxy/core.ts`:

```typescript
// Existing: Cache Store + Analytics Log + Budget Update
// Added: ERC-8004 giveFeedback (async, doesn't block response on failure)
await Promise.all([
  cacheStore(req, response),
  analyticsLog(req, response),
  budgetUpdate(req, response),
  erc8004Audit.recordPaymentFeedback({...}).catch(err =>
    console.warn('ERC-8004 feedback failed:', err)
  ),
]);
```

### 4. Quality Score Calculation Logic

| Condition | Score |
|------|------|
| 2xx + latency < 200ms | 100 |
| 2xx + latency < 500ms | 85 |
| 2xx + latency < 1000ms | 70 |
| 2xx + latency < 3000ms | 50 |
| 2xx + latency >= 3000ms | 30 |
| Non-2xx response | 10 |

### 5. ERC-8004 Contract ABI

ABI JSON files in `packages/proxy/src/audit/abi/` directory:
- `ReputationRegistry.json` — `giveFeedback(agentId, value, valueDecimals, tag1, tag2, feedbackURI, feedbackHash)`
  - **FeedbackGiven event**: `(indexed string agentId, string agentIdRaw, uint256 value, bytes32 tag1, bytes32 tag2, string feedbackURI, bytes32 feedbackHash)`
  - `agentIdRaw`: Non-indexed original agentId string (preserves original text since EVM converts indexed strings to keccak256 hash)
- `ValidationRegistry.json` — `validationRequest(agentId, data)`

### 6. Environment Variables

```env
# ERC-8004 (SKALE bite-v2-sandbox, v1.1.0 deployment)
ERC8004_REPUTATION_REGISTRY=0xCC46EFB2118C323D5E1543115C4b4DfA3bc02131
ERC8004_VALIDATION_REGISTRY=0x05bf80675DcFD3fdD1F7889685CB925C9c56c308
ERC8004_SIGNER_KEY=...              # Signer key for recording feedback
IPFS_API_URL=https://ipfs.infura.io:5001
```

## On-Chain Data Structure (giveFeedback Parameters)

| Field | Value | Description |
|------|------|------|
| `agentId` | ERC-8004 ID of x402 server | Service identifier registered in Identity Registry (indexed → keccak256 hash) |
| `agentIdRaw` | Original agentId string | Non-indexed, human-readable hostname (e.g., `api.openai.com`) |
| `value` | 0-100 | Service quality score based on latency + statusCode |
| `valueDecimals` | 2 | Decimal places |
| `tag1` | `x402-payment` | Feedback type tag |
| `tag2` | `api-call` | Service category tag |
| `feedbackURI` | `ipfs://Qm...` | proofOfPayment + serviceMetrics JSON |
| `feedbackHash` | `0x...` | keccak256 hash of feedbackURI content |

## Fallback Strategy

- IPFS upload failure: Set feedbackURI to empty string, continue recording feedback
- SKALE RPC failure: Store in local queue → retry (fire-and-forget, doesn't block response)
- Contract not deployed: Disable (environment variable `ERC8004_ENABLED=false`)

## Completion Criteria

- [x] Implement ERC8004AuditTrail class
- [x] IPFS metadata upload functionality
- [x] Async integration with ProxyCore Post-Processing
- [x] Quality Score calculation logic
- [x] Contract ABI definition
- [x] Update environment variables in `.env.example`
- [x] Support disable mode (`ERC8004_ENABLED`)
- [x] Verify no response blocking on failure
