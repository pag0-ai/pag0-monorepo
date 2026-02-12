# TASK-27: Dashboard 예산 표시 — Mock → 실제 데이터

**Priority**: HIGH
**Status**: ✅ 완료
**Phase**: 5 (Dashboard with Data)

## 문제

`packages/dashboard/app/dashboard/page.tsx` 68-73줄:
```typescript
// Budget data (mock for MVP - replace with actual budget API)
const dailyBudget = { spent: 5_000_000, limit: 10_000_000 };
const monthlyBudget = { spent: 120_000_000, limit: 300_000_000 };
```

백엔드 `/api/analytics/summary` 응답에 이미 `budgetUsage` 포함:
```json
{
  "budgetUsage": {
    "daily": { "limit": "10000000", "spent": "0", "remaining": "10000000", "percentage": 0 },
    "monthly": { "limit": "100000000", "spent": "0", ... }
  }
}
```

## 수정

하드코딩을 `summary.budgetUsage`로 교체.

## 수정 파일

- `packages/dashboard/app/dashboard/page.tsx` — mock 삭제, summary 데이터 사용
