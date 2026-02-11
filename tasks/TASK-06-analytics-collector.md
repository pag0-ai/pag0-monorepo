# TASK-06: Analytics Collector

| 항목 | 내용 |
|------|------|
| **패키지** | `packages/proxy` |
| **예상 시간** | 1시간 |
| **의존성** | [TASK-01](./TASK-01-db-redis-client.md) |
| **차단 대상** | [TASK-05](./TASK-05-proxy-core.md), [TASK-08](./TASK-08-analytics-routes.md) |

## 목표

모든 프록시 요청의 메트릭을 수집하고 저장하는 AnalyticsCollector를 구현한다. PostgreSQL(영구 저장)과 Redis(실시간 카운터) 이중 저장.

## 구현 파일

### `packages/proxy/src/analytics/collector.ts` — AnalyticsCollector

**핵심 메서드**:

1. **`logRequest(log: RequestLog)`** — 비동기, fire-and-forget
   - PG `requests` 테이블에 INSERT
   - Redis MULTI 파이프라인으로 실시간 카운터 업데이트

2. **`updateCounters(log)`** — Redis MULTI 파이프라인
   ```
   키: metrics:{projectId}:{endpoint}:hourly
   필드: requestCount, cacheHitCount, errorCount, totalSpent, totalLatency
   TTL: 7200초 (2시간)
   ```

**RequestLog 인터페이스** (types/index.ts에 추가):
```typescript
interface RequestLog {
  projectId: string;
  endpoint: string;      // normalized hostname
  fullUrl: string;
  method: string;
  statusCode: number;
  cost: string;          // USDC BIGINT string
  cached: boolean;
  latencyMs: number;
  policyId?: string;
  cacheKey?: string;
}
```

**PG INSERT 쿼리**:
```sql
INSERT INTO requests (
  project_id, endpoint, full_url, method, status_code,
  cost, cached, latency_ms, policy_id, cache_key
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
```

**Redis MULTI 파이프라인**:
```typescript
await redis.multi()
  .hincrby(key, 'requestCount', 1)
  .hincrby(key, 'cacheHitCount', log.cached ? 1 : 0)
  .hincrby(key, 'errorCount', log.statusCode >= 400 ? 1 : 0)
  .hincrbyfloat(key, 'totalSpent', parseFloat(log.cost))
  .hincrby(key, 'totalLatency', log.latencyMs)
  .expire(key, 7200)
  .exec();
```

## 테스트 패턴

`prepare-hackathon/test-business-logic-day2.ts`:
- **테스트 4 (Analytics Pipeline)**: Redis MULTI, 3개 요청 로깅, 카운터 검증
- **테스트 5 (PG Request Logging)**: 6개 요청 INSERT, summary/endpoint별 집계 쿼리

## 비동기 로깅 패턴

ProxyCore에서 호출 시 **절대 await 하지 않음**:
```typescript
// Good — fire and forget
this.analytics.logRequest(log).catch(err => console.error('Analytics error:', err));

// Bad — 요청 응답을 블로킹
await this.analytics.logRequest(log);
```

## 테스트 방법

```bash
# Redis + PG 연결 필요
pnpm docker:up

# Day 2 테스트 (Analytics 파이프라인 + PG 로깅)
cd prepare-hackathon && bun run test-business-logic-day2.ts
# → "4. Analytics Collector — Redis MULTI Pipeline" 확인
# → "5. Analytics — PostgreSQL Request Logging & Aggregation" 확인
```

## 주의사항

- `hincrbyfloat`의 totalSpent: Redis에서는 float로 저장됨 (실시간 집계용)
- PG에서는 BIGINT로 저장 (source of truth)
- Redis 카운터는 2시간 후 만료 (hourly aggregation 주기보다 김)
- logRequest 에러는 프록시 응답에 영향 주면 안됨 (catch로 무시)

## 완료 기준

- [x] AnalyticsCollector 클래스 구현
- [x] PG requests 테이블 INSERT 동작
- [x] Redis MULTI 파이프라인 카운터 업데이트 동작
- [x] 비동기 패턴 적용 (fire-and-forget)
- [x] 로컬에서 메트릭 수집 테스트 통과
