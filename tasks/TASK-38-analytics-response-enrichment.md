# TASK-38: Analytics 응답 보강 — topEndpoints cost, endpoints total, costs summary

**Priority**: P1 (데이터 완전성)
**Status**: done
**Phase**: 10 (Data Contract Alignment)
**Packages**: proxy

## 문제

Analytics API 응답에 프론트엔드/MCP가 필요로 하는 필드가 누락되어 있었음.

### /analytics/summary — topEndpoints에 cost 누락
- 기존: `{ endpoint, requestCount }` 만 반환
- 수정: `{ endpoint, requestCount, cost }` 추가 (SQL에 `COALESCE(SUM(cost), 0) as total_cost` 추가)

### /analytics/endpoints — total count 누락
- 기존: `{ endpoints: [...] }`
- 수정: `{ endpoints: [...], total: N }`

### /analytics/costs — 기간 합계 누락
- 기존: `{ timeseries: [...] }`
- 수정: `{ timeseries: [...], total: { spent, saved, requests } }` (BigInt 합산)

## 수정 파일

- `packages/proxy/src/routes/analytics.ts`

## 완료 기준

- [x] topEndpoints에 cost 필드 포함
- [x] endpoints 응답에 total count 포함
- [x] costs 응답에 total 합계 포함 (BigInt 안전 합산)
