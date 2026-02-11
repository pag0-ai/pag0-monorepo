# TASK-14: Policy 관리 UI

| 항목 | 내용 |
|------|------|
| **패키지** | `packages/dashboard` |
| **예상 시간** | 1시간 |
| **의존성** | [TASK-12](./TASK-12-dashboard-layout.md), [TASK-07](./TASK-07-policy-routes.md) |
| **차단 대상** | 없음 |

## 목표

정책 목록 조회, 생성, 수정, 삭제 UI를 구현한다.

## 구현 파일

### `app/policies/page.tsx`

**레이아웃**:
```
┌─────────────────────────────────────────┐
│  Policies        [+ Create Policy]       │
├─────────────────────────────────────────┤
│ Name      | Daily | Monthly | Status | ⋯│
│ Production| $10   | $100    | Active | ✏️🗑️│
│ Dev       | $5    | $50     | Inactive| ✏️🗑️│
└─────────────────────────────────────────┘
```

### 기능

1. **정책 목록 테이블** — 이름, 일일 예산, 월간 예산, 활성 상태, 수정/삭제 버튼
2. **정책 생성 모달/폼** — 이름, maxPerRequest, dailyBudget, monthlyBudget, allowedEndpoints, blockedEndpoints
3. **정책 수정** — 인라인 또는 모달
4. **정책 삭제** — 확인 다이얼로그 후 soft delete

### 데이터 소스

```typescript
const { data: policies, refetch } = useQuery({
  queryKey: ['policies'],
  queryFn: fetchPolicies,
});

const createMutation = useMutation({
  mutationFn: (data) => fetchApi('/api/policies', { method: 'POST', body: JSON.stringify(data) }),
  onSuccess: () => refetch(),
});
```

### USDC 입력 처리

사용자는 달러 단위로 입력 ($1.00), 내부적으로 BIGINT 변환:
```typescript
// 입력: "10" (달러) → 저장: "10000000" (USDC 6 decimals)
const toUsdcBigint = (dollars: string) => String(Math.floor(parseFloat(dollars) * 1_000_000));
const fromUsdcBigint = (usdc: string) => (Number(usdc) / 1_000_000).toFixed(2);
```

### 엔드포인트 입력

Allowed/Blocked endpoints는 쉼표 구분 텍스트 입력:
```
api.openai.com, *.anthropic.com
```

## 테스트 방법

```bash
pnpm dev

# http://localhost:3001/policies 접속
# → 기존 정책 목록 표시
# → "Create Policy" 클릭 → 폼 입력 → 저장
# → 목록에 새 정책 표시
# → 수정/삭제 동작 확인
```

## 완료 기준

- [x] 정책 목록 테이블 구현
- [x] 정책 생성 폼 (USDC 변환 포함)
- [x] 정책 수정 기능
- [x] 정책 삭제 기능 (확인 후)
- [x] 로컬에서 CRUD 전체 플로우 동작 확인
