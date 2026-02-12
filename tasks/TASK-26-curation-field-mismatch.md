# TASK-26: Curation 점수 필드명 불일치 수정

**Priority**: HIGH
**Status**: TODO
**Phase**: 6 (Curation/Rankings)

## 문제

백엔드 curation 점수 필드명과 프론트엔드 인터페이스 불일치.

| 프론트엔드 | 백엔드 |
|-----------|--------|
| `overall` | `overallScore` |
| `cost` | `costScore` |
| `latency` | `latencyScore` |
| `reliability` | `reliabilityScore` |
| `id` (Category) | (없음) |

## 영향

- 랭킹 테이블의 모든 점수가 `NaN` 또는 `undefined`
- 카테고리 필터 ID 매칭 실패

## 수정 파일

- `packages/dashboard/lib/api.ts` — `EndpointScore`, `Category` 인터페이스 수정
- `packages/dashboard/app/rankings/page.tsx` — 점수 참조 업데이트
