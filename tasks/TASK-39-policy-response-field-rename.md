# TASK-39: Policy 응답 필드명 통일 — dailyLimit/monthlyLimit -> dailyBudget/monthlyBudget

**Priority**: P0 (데이터 계약 불일치)
**Status**: done
**Phase**: 10 (Data Contract Alignment)
**Packages**: proxy, mcp

## 문제

`policies.ts` 라우트의 JSON 응답에서 DB 컬럼명 `daily_budget`/`monthly_budget`를 `dailyLimit`/`monthlyLimit`로 매핑하고 있었음. 이는 TASK-07 버그 수정 이후에도 남아 있던 잔여 불일치.

| 위치 | 이전 | 이후 (정확) |
|------|------|------------|
| GET / 목록 | `dailyLimit` | `dailyBudget` |
| POST / 생성 | `dailyLimit` | `dailyBudget` |
| GET /:id 상세 | `dailyLimit` | `dailyBudget` |
| PUT /:id 수정 | `dailyLimit` | `dailyBudget` |

## 관련 충돌

mcp-dev가 `packages/mcp/src/tools/policy.ts`에서 반대 방향으로 수정 중 (`dailyBudget` -> `dailyLimit`). DB 스키마 기준 `dailyBudget`이 정확한 필드명이므로 proxy-dev의 방향이 올바름.

## 수정 파일

- `packages/proxy/src/routes/policies.ts` — 4개 엔드포인트의 응답 매핑 수정
- `packages/mcp/src/tools/policy.ts` — (수정 필요: `dailyBudget`/`monthlyBudget` 유지해야 함)

## 완료 기준

- [x] proxy policies.ts에서 `dailyBudget`/`monthlyBudget` 사용
- [x] mcp policy.ts 필드명 정렬 완료 (mcp-dev가 수정)
- [x] dashboard Policy 인터페이스와 일치 확인
