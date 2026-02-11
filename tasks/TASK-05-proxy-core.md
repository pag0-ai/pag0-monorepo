# TASK-05: Proxy Core + x402 통합

| 항목 | 내용 |
|------|------|
| **패키지** | `packages/proxy` |
| **예상 시간** | 2시간 |
| **의존성** | [TASK-03](./TASK-03-policy-engine.md), [TASK-04](./TASK-04-cache-layer.md), [TASK-06](./TASK-06-analytics-collector.md) |
| **차단 대상** | [TASK-11](./TASK-11-integration.md) |

## 목표

x402 프록시 요청 처리의 핵심 로직을 구현한다. 2-pass 결제 플로우(402 → 서명 → 재시도)를 포함.

## 구현 파일

### 1. `packages/proxy/src/proxy/x402.ts` — X402Integration

**역할**: x402 서버로의 요청 전달 및 402 응답 파싱

```typescript
export class X402Integration {
  async forwardRequest(url: string, options: RequestInit): Promise<Response>;
  async forwardWithPayment(url: string, options: RequestInit, signedPayment: SignedPayment): Promise<Response>;
  parsePaymentRequest(response: Response): PaymentRequiredResponse;
}
```

**x402 헤더 처리** (`@x402/core/http` 활용):
- `decodePaymentRequiredHeader()` — 402 응답의 payment 정보 디코딩
- `encodePaymentResponseHeader()` — 결제 완료 후 헤더 인코딩

> **CRITICAL**: 프록시는 절대 결제를 서명하지 않는다. Payment relay만 수행.

### 2. `packages/proxy/src/proxy/core.ts` — ProxyCore

**`handleRequest(req)` 전체 흐름** (8단계):

```
1. Policy 검증 (PolicyEngine.evaluate)
   → 실패 시 403 PolicyViolationError

2. Cache 체크 (CacheLayer.get)
   → 캐시 히트 시 바로 응답 반환 (cost=0, cached=true)

3. x402 서버로 요청 전달 (X402Integration.forwardRequest)

4. 402 응답 처리
   → PaymentRequired 파싱 후 Agent에게 relay (프록시 비서명)

5. signedPayment 포함 재요청
   → nonce 확인 (replay 방지: Redis nonce:{paymentId})
   → x402 서버로 결제 정보와 함께 전달

6. 응답 캐싱 (isCacheable 조건 충족 시)

7. Analytics 로깅 (비동기, 요청 블로킹 금지)

8. Budget 차감 (BudgetTracker.deduct)
```

**ProxyResponse 메타데이터**:
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

**Replay 방지**:
```typescript
const nonceKey = `nonce:${signedPayment.id}`;
const exists = await redis.get(nonceKey);
if (exists) throw new Error('Payment replay detected');
await redis.setex(nonceKey, 3600, '1');  // 1시간 TTL
```

## 테스트 패턴

`prepare-hackathon/test-business-logic-day1.ts`:
- **테스트 6 (x402 Headers)**: PaymentRequired 인코딩/디코딩, 비용 추출
- **테스트 1 (USDC Arithmetic)**: BigInt 연산

`prepare-hackathon/test-business-logic-day3.ts`:
- **테스트 7 (Demo Scenario)**: 전체 프록시 플로우 시뮬레이션 (11단계)
  - Auth → Rate Limit → Policy → Budget → Cache → x402 → Payment → Cache Store → Budget Update → Analytics → 재요청 캐시 히트

## x402 SDK 참고

`prepare-hackathon/DAY0-FINDINGS.md` 및 `test-x402-sdk.ts`:
- `@x402/fetch` v2.3.0 exports: `wrapFetchWithPayment`, `x402Client`
- `@x402/core/http`: `encodePaymentRequiredHeader`, `decodePaymentRequiredHeader`
- `@x402/core/types`: `PaymentRequired`, `SettleResponse`
- 402 헤더: base64 인코딩된 JSON

## 테스트 방법

```bash
# Docker 로컬 환경 (Redis + PG)
pnpm docker:up

# 서버 시작
pnpm dev:proxy

# 프록시 요청 테스트 (x402 서버가 없으면 일반 HTTP 서버로 대체)
curl -X POST http://localhost:3000/proxy \
  -H "X-Pag0-API-Key: {demo_key}" \
  -H "Content-Type: application/json" \
  -d '{"targetUrl": "https://httpbin.org/get", "method": "GET"}'

# 전체 플로우 시뮬레이션
cd prepare-hackathon && bun run test-business-logic-day3.ts
```

## 폴백 전략

x402 SDK 통합 실패 시:
- 일반 HTTP fetch로 대체 (`fetch(targetUrl, options)`)
- 402 응답은 mock PaymentRequired로 시뮬레이션
- Demo에서는 mock x402 서버 사용 가능

## 주의사항

- Analytics 로깅은 반드시 **비동기** (fire-and-forget, 요청 응답 블로킹 금지)
- Budget 차감은 결제 성공 후에만 수행
- `metadata.budgetRemaining`은 매 응답에 포함

## 완료 기준

- [ ] X402Integration 클래스 구현 (forwardRequest, parsePaymentRequest)
- [ ] ProxyCore 클래스 구현 (8단계 전체 흐름)
- [ ] 402 → Agent relay → 재시도 플로우 동작
- [ ] Replay 방지 (nonce 체크)
- [ ] Cache 히트 시 cost=0 응답
- [ ] Analytics 비동기 로깅
- [ ] 로컬에서 curl로 프록시 요청 테스트
