# TASK-15: API Ranking Board

| 항목 | 내용 |
|------|------|
| **패키지** | `packages/dashboard` |
| **예상 시간** | 1시간 |
| **의존성** | [TASK-12](./TASK-12-dashboard-layout.md), [TASK-09](./TASK-09-curation-routes.md) |
| **차단 대상** | 없음 |

## 목표

카테고리별 API 엔드포인트 랭킹, 점수 비교, 추천을 시각화한다.

## 구현 파일

### `app/rankings/page.tsx`

**레이아웃**:
```
┌─────────────────────────────────────────────────┐
│  API Rankings    [AI ▾] [Data ▾] [Blockchain ▾]  │
├─────────────────────────────────────────────────┤
│ # | Endpoint         | Overall | Cost | Latency | Reliability │
│ 1 | api.anthropic.com| 🟢 92   | 88   | 95      | 99          │
│ 2 | api.openai.com   | 🟢 85   | 75   | 88      | 98          │
│ 3 | api.cohere.com   | 🟡 78   | 82   | 70      | 95          │
└─────────────────────────────────────────────────┘
┌──────────────────────┬──────────────────────────┐
│  Comparison Panel    │  Category Overview       │
│  [Select endpoints]  │  AI: avg 85              │
│  [Compare]           │  Data: avg 82            │
│                      │  Blockchain: avg 78      │
└──────────────────────┴──────────────────────────┘
```

### 기능

1. **카테고리 필터** — 드롭다운 (AI, Data, Blockchain, IoT, Finance, Social, Communication, Storage)
2. **랭킹 테이블** — 순위, 엔드포인트, Overall/Cost/Latency/Reliability 점수
3. **점수 뱃지** — 색상 코딩 (>80 초록, 60-80 노랑, <60 빨강)
4. **엔드포인트 비교** — 2~5개 선택 후 비교 (side-by-side)
5. **카테고리 개요** — 카테고리별 엔드포인트 수, 평균 점수

### 데이터 소스

```typescript
const { data: rankings } = useQuery({
  queryKey: ['rankings', category],
  queryFn: () => fetchRankings({ category }),
});

const { data: categories } = useQuery({
  queryKey: ['categories'],
  queryFn: fetchCategories,
});

// 비교 (on-demand)
const compareMutation = useMutation({
  mutationFn: (endpoints: string[]) =>
    fetchApi(`/api/curation/compare?endpoints=${endpoints.join(',')}`),
});
```

### 점수 뱃지 컴포넌트

```typescript
function ScoreBadge({ score }: { score: number }) {
  const color = score >= 80 ? 'text-green-400' : score >= 60 ? 'text-yellow-400' : 'text-red-400';
  return <span className={color}>{score}</span>;
}
```

## 테스트 방법

```bash
pnpm dev

# http://localhost:3001/rankings 접속
# → seed 데이터 기반 랭킹 테이블 표시 (5개 endpoint_scores)
# → 카테고리 변경 시 필터링
# → 점수 뱃지 색상 확인
# → 비교 기능 동작 (2개 선택 → Compare)
```

## 완료 기준

- [ ] 카테고리 필터 드롭다운
- [ ] 랭킹 테이블 (순위 + 4개 점수)
- [ ] 점수 뱃지 색상 코딩
- [ ] 엔드포인트 비교 기능
- [ ] 카테고리 개요
- [ ] 로컬에서 seed 데이터 기반 렌더링 확인
