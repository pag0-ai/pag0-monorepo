# TASK-08: Analytics API Routes

| 항목 | 내용 |
|------|------|
| **패키지** | `packages/proxy` |
| **예상 시간** | 1.5시간 |
| **의존성** | [TASK-01](./TASK-01-db-redis-client.md), [TASK-06](./TASK-06-analytics-collector.md) |
| **차단 대상** | [TASK-11](./TASK-11-integration.md), [TASK-13](./TASK-13-dashboard-metrics.md) |

## 목표

Analytics API 4개 엔드포인트를 구현하여 Dashboard에서 사용할 통계 데이터를 제공한다.

## 구현 파일

### `packages/proxy/src/routes/analytics.ts`

### 엔드포인트 목록

| Method | Path | 설명 |
|--------|------|------|
| GET | `/summary` | 전체 요약 통계 |
| GET | `/endpoints` | 엔드포인트별 상세 메트릭 |
| GET | `/costs` | 비용 시계열 데이터 |
| GET | `/cache` | 캐시 성능 분석 |

### GET `/summary` — 전체 요약

**쿼리 파라미터**: `period` (`1h`, `24h`, `7d`, `30d`, 기본 `7d`)

**응답 구조** (`docs/04-API-SPEC.md` 섹션 3.1):
```typescript
{
  period: string;
  totalRequests: number;
  cacheHitRate: number;       // 0.0 - 1.0
  avgLatency: number;         // ms
  successRate: number;        // 0.0 - 1.0
  totalCost: string;          // USDC
  cacheSavings: string;       // USDC
  topEndpoints: Array<{ endpoint, requestCount, cost }>;
  budgetUsage: {
    daily: { limit, spent, remaining, percentage };
    monthly: { limit, spent, remaining, percentage };
  };
}
```

**핵심 SQL** (`docs/05-DB-SCHEMA.md` 쿼리 5.3):
```sql
SELECT
  COUNT(*) as total_requests,
  SUM(CASE WHEN cached THEN 1 ELSE 0 END)::float / COUNT(*) as cache_hit_rate,
  AVG(latency_ms) as avg_latency,
  SUM(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 ELSE 0 END)::float / COUNT(*) as success_rate,
  SUM(cost) as total_cost,
  SUM(CASE WHEN cached THEN cost ELSE 0 END) as cache_savings
FROM requests
WHERE project_id = $1 AND created_at >= NOW() - INTERVAL $2
```

**period → SQL interval 변환**: `1h` → `'1 hour'`, `24h` → `'24 hours'`, `7d` → `'7 days'`, `30d` → `'30 days'`

### GET `/endpoints` — 엔드포인트별 메트릭

**쿼리 파라미터**: `period`, `limit` (기본 20), `orderBy` (기본 `requestCount`)

**핵심 SQL** (`docs/05-DB-SCHEMA.md` 쿼리 5.5):
```sql
SELECT endpoint, COUNT(*) as request_count,
  SUM(CASE WHEN cached THEN 1 ELSE 0 END) as cache_hit_count,
  AVG(latency_ms) as avg_latency_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) as p95_latency_ms,
  ...
FROM requests WHERE project_id = $1 AND created_at >= ...
GROUP BY endpoint ORDER BY request_count DESC LIMIT $2
```

### GET `/costs` — 비용 시계열

**쿼리 파라미터**: `period`, `granularity` (`hourly`, `daily`, `monthly`)

```sql
SELECT DATE_TRUNC($1, created_at) as timestamp,
  SUM(cost) as spent,
  SUM(CASE WHEN cached THEN cost ELSE 0 END) as saved,
  COUNT(*) as request_count
FROM requests WHERE project_id = $2 AND created_at >= ...
GROUP BY DATE_TRUNC($1, created_at)
ORDER BY timestamp DESC
```

### GET `/cache` — 캐시 성능

```sql
SELECT
  SUM(CASE WHEN cached THEN 1 ELSE 0 END) as hit_count,
  SUM(CASE WHEN NOT cached THEN 1 ELSE 0 END) as miss_count,
  SUM(CASE WHEN cached THEN 1 ELSE 0 END)::float / COUNT(*) as hit_rate
FROM requests WHERE project_id = $1 AND created_at >= ...
```

## 테스트 패턴

`prepare-hackathon/test-business-logic-day2.ts` — **테스트 5**: PG summary/endpoint 쿼리
`prepare-hackathon/test-business-logic-day3.ts` — **테스트 3, 4, 5**: Dashboard summary, cost timeseries, cache analytics

## 테스트 방법

```bash
pnpm dev:proxy

# Summary
curl -H "X-Pag0-API-Key: {key}" "http://localhost:3000/api/analytics/summary?period=7d"

# Endpoints
curl -H "X-Pag0-API-Key: {key}" "http://localhost:3000/api/analytics/endpoints?limit=10"

# Costs
curl -H "X-Pag0-API-Key: {key}" "http://localhost:3000/api/analytics/costs?period=30d&granularity=daily"

# Cache
curl -H "X-Pag0-API-Key: {key}" "http://localhost:3000/api/analytics/cache?period=7d"
```

## 완료 기준

- [x] 4개 analytics 엔드포인트 구현
- [x] period 파라미터 → SQL interval 변환
- [x] budgetUsage 포함 (summary)
- [x] topEndpoints 포함 (summary)
- [x] 로컬에서 curl 테스트 통과 (seed 데이터 기반)

## 버그 수정 이력

- **SQL interval 버그 수정**: `${sql(interval)}::interval` → `${interval}::interval` (6개소). `sql()` 함수는 SQL 식별자(컬럼명)를 생성하여 `"24 hours"`처럼 따옴표가 붙어 `column "24 hours" does not exist` 에러 발생. 문자열 파라미터로 변경하여 `'24 hours'::interval`로 정상 캐스팅.
- **budget 쿼리 수정**: `budgets` 테이블에 `daily_limit`/`monthly_limit` 컬럼이 없으므로, `policies` 테이블과 LEFT JOIN하여 한도 값을 가져오도록 수정.
