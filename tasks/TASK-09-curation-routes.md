# TASK-09: Curation API Routes

| 항목 | 내용 |
|------|------|
| **패키지** | `packages/proxy` |
| **예상 시간** | 1.5시간 |
| **의존성** | [TASK-01](./TASK-01-db-redis-client.md) |
| **차단 대상** | [TASK-11](./TASK-11-integration.md), [TASK-15](./TASK-15-ranking-board.md) |

## 목표

Curation Engine(스코어링 알고리즘)과 5개 API 엔드포인트를 구현한다. 엔드포인트 점수 계산, 추천, 비교, 랭킹, 카테고리 조회.

## 구현 파일

### 1. `packages/proxy/src/curation/engine.ts` — CurationEngine

**스코어링 알고리즘** (`docs/03-TECH-SPEC.md` 섹션 2.5.2):

```typescript
// Cost Score: 낮을수록 높은 점수
scoreCost(avgCost, benchmarkCost): number {
  const ratio = avgCost / benchmarkCost;
  if (ratio >= 2) return 0;
  if (ratio <= 0.5) return 100;
  return 100 * (1 - (ratio - 0.5) / 1.5);
}

// Latency Score: 낮을수록 높은 점수 (동일 공식)
scoreLatency(p95Latency, benchmarkLatency): number

// Reliability Score: 높을수록 높은 점수
scoreReliability(successRate): number {
  return Math.min(100, successRate * 100);
}

// Overall = cost*0.4 + latency*0.3 + reliability*0.3
calculateOverallScore(cost, latency, reliability, weights?)
```

**메서드**:
- `calculateScore(endpoint, category)` — 30일 메트릭 기반 점수 계산
- `getScore(endpoint)` — Redis 캐시 우선, 없으면 PG 조회
- `recommend(category, limit, sortBy?)` — 카테고리별 추천
- `compare(endpoints[])` — 2~5개 엔드포인트 비교
- `getBenchmarks(category)` — 카테고리 평균 (벤치마크)

### 2. `packages/proxy/src/routes/curation.ts` — API Routes

| Method | Path | 설명 |
|--------|------|------|
| GET | `/recommend` | 카테고리별 추천 |
| GET | `/compare` | 엔드포인트 비교 |
| GET | `/rankings` | 카테고리별 랭킹 |
| GET | `/categories` | 카테고리 목록 |
| GET | `/score/:endpoint` | 개별 점수 조회 |

### GET `/recommend`

**쿼리**: `category` (필수), `limit` (기본 5), `weights` (선택, `cost:0.5,latency:0.3,reliability:0.2`)

```sql
SELECT * FROM endpoint_scores
WHERE category = $1
ORDER BY overall_score DESC
LIMIT $2
```

### GET `/compare`

**쿼리**: `endpoints` (쉼표 구분, 2~5개)

응답에 `winner` 포함 (overall, cost, latency, reliability 각 차원별 승자).

### GET `/rankings`

**쿼리**: `category` (선택), `limit` (기본 20), `orderBy` (기본 `overall`)

### GET `/categories`

```sql
SELECT c.name, c.endpoint_count,
  ROUND(AVG(es.overall_score), 2) as avg_score
FROM categories c
LEFT JOIN endpoint_scores es ON es.category = c.name
GROUP BY c.name, c.endpoint_count
```

### GET `/score/:endpoint`

Redis 캐시 우선 조회 (`score:{endpoint}`, TTL 300초). Miss 시 PG에서 조회 후 Redis 저장.

## 테스트 패턴

`prepare-hackathon/test-business-logic-day2.ts`:
- **테스트 1 (Curation Scoring)**: scoreCost, scoreLatency, scoreReliability 공식 검증
- **테스트 2 (Recommendation & Comparison)**: recommend (top-N), compare (차원별 winner)
- **테스트 6 (Score Caching)**: Redis score:{endpoint} 패턴

`prepare-hackathon/test-business-logic-day3.ts`:
- **테스트 6 (Endpoint Score CRUD)**: UPSERT, 랭킹, 카테고리 집계

## 테스트 방법

```bash
pnpm dev:proxy

# 추천
curl -H "X-Pag0-API-Key: {key}" "http://localhost:3000/api/curation/recommend?category=AI&limit=5"

# 비교
curl -H "X-Pag0-API-Key: {key}" "http://localhost:3000/api/curation/compare?endpoints=api.openai.com,api.anthropic.com"

# 랭킹
curl -H "X-Pag0-API-Key: {key}" "http://localhost:3000/api/curation/rankings?category=AI"

# 카테고리
curl -H "X-Pag0-API-Key: {key}" "http://localhost:3000/api/curation/categories"

# 점수
curl -H "X-Pag0-API-Key: {key}" "http://localhost:3000/api/curation/score/api.openai.com"
```

## 데이터 부족 시

seed.sql에 5개 sample endpoint_scores가 이미 존재. 추가 seed 데이터가 필요하면 `db/seed.sql`에 추가.

## 완료 기준

- [ ] CurationEngine 스코어링 알고리즘 구현 (3개 차원 + overall)
- [ ] 5개 curation 엔드포인트 구현
- [ ] Redis score 캐싱 (TTL 300초)
- [ ] compare에서 차원별 winner 계산
- [ ] 로컬에서 seed 데이터 기반 API 테스트 통과
