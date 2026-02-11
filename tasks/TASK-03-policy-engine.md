# TASK-03: Policy Engine + Budget Tracker

| 항목 | 내용 |
|------|------|
| **패키지** | `packages/proxy` |
| **예상 시간** | 1.5시간 |
| **의존성** | [TASK-01](./TASK-01-db-redis-client.md) |
| **차단 대상** | [TASK-05](./TASK-05-proxy-core.md), [TASK-07](./TASK-07-policy-routes.md) |

## 목표

프록시 요청 전 정책 검증을 수행하는 PolicyEngine과, 일일/월별 예산을 추적하는 BudgetTracker를 구현한다.

## 구현 파일

### 1. `packages/proxy/src/policy/engine.ts` — PolicyEngine

**evaluate(req) 검증 순서** (5단계):
1. **Blocked endpoint 체크** — `blockedEndpoints` 배열에 포함 시 거부
2. **Allowed endpoint 체크** — 빈 배열이면 전체 허용, 아니면 화이트리스트 매칭
3. **Per-request 한도** — `cost > maxPerRequest` 시 거부
4. **Daily 예산** — `dailySpent + cost > dailyBudget` 시 거부
5. **Monthly 예산** — `monthlySpent + cost > monthlyBudget` 시 거부

**엔드포인트 매칭**: 와일드카드 패턴 지원 (`*.openai.com`)
```typescript
private matchPattern(hostname: string, pattern: string): boolean {
  const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
  return regex.test(hostname);
}
```

**반환 타입**:
```typescript
interface PolicyEvaluation {
  allowed: boolean;
  reason?: 'ENDPOINT_BLOCKED' | 'ENDPOINT_NOT_WHITELISTED' |
           'PER_REQUEST_LIMIT_EXCEEDED' | 'DAILY_BUDGET_EXCEEDED' |
           'MONTHLY_BUDGET_EXCEEDED';
  details?: string;
}
```

### 2. `packages/proxy/src/policy/budget.ts` — BudgetTracker

**Redis 기반 예산 추적**:
- 키: `budget:{projectId}:daily`, `budget:{projectId}:monthly`
- INCRBY로 원자적 증가
- TTL: daily = 자정 UTC까지, monthly = 월말까지
- `getDailySpent()`, `getMonthlySpent()`, `deduct()` 메서드

**PostgreSQL 동기화**:
- 결제 성공 시 `budgets` 테이블도 업데이트 (atomic UPDATE ... RETURNING)
- Redis는 캐시, PG가 source of truth

## 테스트 패턴

`prepare-hackathon/test-business-logic-day1.ts` 참조:
- **테스트 2 (Policy Engine)**: 6가지 시나리오 — 허용, 블록, 비허가, 한도초과, 일일초과, 월간초과
- **테스트 4 (Budget Tracker)**: Redis INCRBY, TTL 설정, 누적 추적

## USDC 금액 처리 규칙

- **항상 BigInt 비교**: `BigInt(cost) > BigInt(policy.maxPerRequest)`
- **절대 parseFloat 금지**: 1 USDC = `"1000000"` (string BIGINT)
- DB 저장: BIGINT 컬럼, Redis 저장: string

## 테스트 방법

```bash
# 단위 테스트 (budget tracker)
# Docker 로컬 Redis 필요
bun test src/policy/

# 또는 prepare-hackathon 테스트 활용
cd prepare-hackathon && bun run test-business-logic-day1.ts
```

## 완료 기준

- [x] PolicyEngine 클래스 구현 (5단계 검증)
- [x] BudgetTracker 클래스 구현 (Redis + PG)
- [x] 와일드카드 패턴 매칭 (`*.openai.com`)
- [x] BigInt 기반 금액 비교 (parseFloat 미사용)
- [x] 로컬에서 정책 검증 로직 테스트 통과
- [x] PolicyEngine 단위 테스트 작성 (20개 테스트, `engine.test.ts`)

## 버그 수정 이력

- **engine.ts SQL 컬럼명 수정**: `daily_limit`/`monthly_limit` → `daily_budget`/`monthly_budget`. DB 스키마(`policies` 테이블)의 실제 컬럼명과 불일치 수정.
- **budget.ts checkBudget() 수정**: `budgets` 테이블에는 `daily_limit`/`monthly_limit` 컬럼이 없음. `policies` 테이블과 LEFT JOIN하여 한도 값을 가져오도록 수정.
- **budget.ts recordSpend() 수정**: INSERT 쿼리에서 존재하지 않는 `daily_limit`/`monthly_limit` 컬럼 제거.
