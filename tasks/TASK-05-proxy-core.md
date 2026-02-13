# TASK-05: Proxy Core + x402 Integration

| Item | Content |
|------|------|
| **Package** | `packages/proxy` |
| **Estimated Time** | 2 hours |
| **Dependencies** | [TASK-03](./TASK-03-policy-engine.md), [TASK-04](./TASK-04-cache-layer.md), [TASK-06](./TASK-06-analytics-collector.md) |
| **Blocks** | [TASK-11](./TASK-11-integration.md) |

## Goal

Implement the core logic for x402 proxy request handling. Includes 2-pass payment flow (402 → sign → retry).

## Implementation Files

### 1. `packages/proxy/src/proxy/x402.ts` — X402Integration

**Role**: Forward requests to x402 server and parse 402 responses

```typescript
export class X402Integration {
  async forwardRequest(url: string, options: RequestInit): Promise<Response>;
  async forwardWithPayment(url: string, options: RequestInit, signedPayment: SignedPayment): Promise<Response>;
  parsePaymentRequest(response: Response): PaymentRequiredResponse;
}
```

**x402 Header Processing** (using `@x402/core/http`):
- `decodePaymentRequiredHeader()` — Decode payment info from 402 response
- `encodePaymentResponseHeader()` — Encode header after payment completion

> **CRITICAL**: Proxy NEVER signs payments. Only performs payment relay.

### 2. `packages/proxy/src/proxy/core.ts` — ProxyCore

**`handleRequest(req)` Complete Flow** (8 steps):

```
1. Policy Validation (PolicyEngine.evaluate)
   → Return 403 PolicyViolationError on failure

2. Cache Check (CacheLayer.get)
   → Return response immediately on cache hit (cost=0, cached=true)

3. Forward Request to x402 Server (X402Integration.forwardRequest)

4. Handle 402 Response
   → Parse PaymentRequired and relay to Agent (proxy does not sign)

5. Retry Request with signedPayment
   → Check nonce (replay prevention: Redis nonce:{paymentId})
   → Forward to x402 server with payment info

6. Cache Response (if isCacheable conditions met)

7. Analytics Logging (async, must not block request)

8. Budget Deduction (BudgetTracker.deduct)
```

**ProxyResponse Metadata**:
```typescript
metadata: {
  cost: string;           // "0" for cached, "500000" for paid
  cached: boolean;
  cacheAge?: number;      // seconds since cached
  latency: number;        // ms
  endpoint: string;       // normalized hostname
  budgetRemaining: {
    daily: string;
    monthly: string;
  };
}
```

**Replay Prevention**:
```typescript
const nonceKey = `nonce:${signedPayment.id}`;
const exists = await redis.get(nonceKey);
if (exists) throw new Error('Payment replay detected');
await redis.setex(nonceKey, 3600, '1');  // 1 hour TTL
```

## Test Patterns

`prepare-hackathon/test-business-logic-day1.ts`:
- **Test 6 (x402 Headers)**: PaymentRequired encoding/decoding, cost extraction
- **Test 1 (USDC Arithmetic)**: BigInt operations

`prepare-hackathon/test-business-logic-day3.ts`:
- **Test 7 (Demo Scenario)**: Complete proxy flow simulation (11 steps)
  - Auth → Rate Limit → Policy → Budget → Cache → x402 → Payment → Cache Store → Budget Update → Analytics → Retry Cache Hit

## x402 SDK Reference

`prepare-hackathon/DAY0-FINDINGS.md` and `test-x402-sdk.ts`:
- `@x402/fetch` v2.3.0 exports: `wrapFetchWithPayment`, `x402Client`
- `@x402/core/http`: `encodePaymentRequiredHeader`, `decodePaymentRequiredHeader`
- `@x402/core/types`: `PaymentRequired`, `SettleResponse`
- 402 header: base64-encoded JSON

## Testing Method

```bash
# Docker local environment (Redis + PG)
pnpm docker:up

# Start server
pnpm dev:proxy

# Test proxy request (replace with regular HTTP server if x402 server unavailable)
curl -X POST http://localhost:3000/proxy \
  -H "X-Pag0-API-Key: {demo_key}" \
  -H "Content-Type: application/json" \
  -d '{"targetUrl": "https://httpbin.org/get", "method": "GET"}'

# Complete flow simulation
cd prepare-hackathon && bun run test-business-logic-day3.ts
```

## Fallback Strategy

If x402 SDK integration fails:
- Fall back to regular HTTP fetch (`fetch(targetUrl, options)`)
- Simulate 402 response with mock PaymentRequired
- Use mock x402 server for demo

## Cautions

- Analytics logging must be **async** (fire-and-forget, must not block request response)
- Budget deduction only after successful payment
- `metadata.budgetRemaining` must be included in every response

## Completion Criteria

- [x] X402Integration class implemented (forwardRequest, parsePaymentRequest)
- [x] ProxyCore class implemented (complete 8-step flow)
- [x] 402 → Agent relay → retry flow working
- [x] Replay prevention (nonce check)
- [x] cost=0 response on cache hit
- [x] Analytics async logging
- [x] Test proxy request with curl locally
