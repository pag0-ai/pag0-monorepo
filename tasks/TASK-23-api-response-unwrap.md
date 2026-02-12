# TASK-23: API 응답 언래핑 — 프론트엔드/백엔드 데이터 계약 정렬

**Priority**: HIGH (모든 대시보드 페이지가 깨지는 원인)
**Status**: TODO
**Phase**: 5 (Dashboard with Data)

## 문제

백엔드는 응답을 래퍼 객체로 감싸서 반환하지만, 프론트엔드 `fetchApi<T>`는 응답 자체를 데이터로 기대함.

| 엔드포인트 | 백엔드 반환 | 프론트엔드 기대 |
|-----------|------------|----------------|
| `GET /api/policies` | `{ policies: [...], total }` | `Policy[]` |
| `GET /api/analytics/endpoints` | `{ endpoints: [...] }` | `EndpointMetrics[]` |
| `GET /api/analytics/costs` | `{ timeseries: [...] }` | `CostDataPoint[]` |
| `GET /api/analytics/cache` | `{ hitCount, missCount, ... }` | `{ totalHits, totalMisses, ... }` |
| `GET /api/curation/rankings` | `{ data: [...] }` | `EndpointScore[]` |
| `GET /api/curation/categories` | `{ data: [...] }` | `Category[]` |

## 수정 방법

`packages/dashboard/lib/api.ts`의 각 fetch 함수에서 응답 언래핑:

```typescript
// Before
export async function fetchPolicies(apiKey?: string): Promise<Policy[]> {
  return fetchApi('/api/policies', { apiKey });
}

// After
export async function fetchPolicies(apiKey?: string): Promise<Policy[]> {
  const res = await fetchApi<{ policies: Policy[] }>('/api/policies', { apiKey });
  return res.policies;
}
```

## 영향 범위

- `packages/dashboard/lib/api.ts` — 6개 함수 수정
- 대시보드, 정책, 랭킹 페이지 모두 영향
