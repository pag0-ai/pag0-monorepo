# TASK-42: Policy 필드명 전체 패키지 정렬 (R2)

**Priority**: P0 (cross-package 데이터 계약)
**Status**: done
**Phase**: 11 (R2 Cross-Package Alignment)
**Packages**: dashboard, mcp
**Related**: TASK-39 (proxy 쪽 수정 완료, R1)

## 문제

R1에서 TASK-39로 proxy의 policy 응답 필드명을 `dailyLimit`/`monthlyLimit` -> `dailyBudget`/`monthlyBudget`로 수정했으나, dashboard와 MCP 패키지에서 여전히 이전 필드명을 사용하고 있었음. 이로 인해 정책 편집/표시 시 `undefined` 값이 렌더링되는 P0 버그 발생.

## 수정 내용

### packages/dashboard/lib/api.ts
- `Policy` interface: `dailyLimit` -> `dailyBudget`, `monthlyLimit` -> `monthlyBudget`

### packages/dashboard/app/policies/page.tsx
- `handleEdit()`: `policy.dailyLimit` -> `policy.dailyBudget`, `policy.monthlyLimit` -> `policy.monthlyBudget`
- Policy 테이블 렌더링: 동일 필드명 수정 (2곳)

### packages/mcp/src/tools/policy.ts
- `pag0_list_policies` 응답 타입: `dailyLimit` -> `dailyBudget`, `monthlyLimit` -> `monthlyBudget`

## 완료 기준

- [x] Dashboard Policy interface가 `dailyBudget`/`monthlyBudget` 사용
- [x] Dashboard policies page가 올바른 필드명으로 렌더링
- [x] MCP policy tool 응답 타입이 proxy API와 일치
- [x] 3개 패키지 (proxy, dashboard, mcp) 모두 동일 필드명 사용
