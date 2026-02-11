# TASK-13: Dashboard 메트릭 시각화

| 항목 | 내용 |
|------|------|
| **패키지** | `packages/dashboard` |
| **예상 시간** | 1.5시간 |
| **의존성** | [TASK-12](./TASK-12-dashboard-layout.md), [TASK-08](./TASK-08-analytics-routes.md) |
| **차단 대상** | 없음 |

## 목표

Dashboard 메인 페이지에 핵심 메트릭 카드, 비용 차트, 엔드포인트 테이블을 구현한다.

## 구현 파일

### `app/dashboard/page.tsx`

**레이아웃 구조**:
```
┌──────────┬──────────┬──────────┬──────────┐
│ Total    │ Cache    │ Avg      │ Cache    │
│ Requests │ Hit Rate │ Latency  │ Savings  │
└──────────┴──────────┴──────────┴──────────┘
┌────────────────────────────────────────────┐
│          Cost Chart (LineChart)             │
│    — Spent (purple)  — Saved (green)       │
└────────────────────────────────────────────┘
┌────────────────────────────────────────────┐
│       Top Endpoints Table                  │
│ Endpoint | Requests | Cost | Cache | Latency|
└────────────────────────────────────────────┘
┌──────────────────┬─────────────────────────┐
│  Budget Usage    │  Success Rate           │
│  (Daily/Monthly) │  (Pie or Bar)           │
└──────────────────┴─────────────────────────┘
```

### 데이터 소스 (React Query)

```typescript
const { data: summary } = useQuery({
  queryKey: ['analytics', 'summary', period],
  queryFn: () => fetchAnalyticsSummary(period),
});

const { data: costs } = useQuery({
  queryKey: ['analytics', 'costs', period],
  queryFn: () => fetchAnalyticsCosts({ period, granularity: 'daily' }),
});

const { data: endpoints } = useQuery({
  queryKey: ['analytics', 'endpoints', period],
  queryFn: () => fetchAnalyticsEndpoints({ period, limit: 10 }),
});
```

### 컴포넌트

1. **MetricCard** (4개) — Total Requests, Cache Hit Rate (%), Avg Latency (ms), Cache Savings ($)
2. **CostChart** — `recharts` LineChart (spent vs saved, 시계열)
3. **EndpointTable** — 상위 엔드포인트 테이블 (정렬 가능)
4. **BudgetProgress** — Daily/Monthly 예산 사용량 프로그레스 바
5. **PeriodSelector** — `1h | 24h | 7d | 30d` 기간 선택

### CostChart 컴포넌트

```typescript
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

<ResponsiveContainer width="100%" height={300}>
  <LineChart data={costs.timeseries}>
    <XAxis dataKey="timestamp" />
    <YAxis />
    <Tooltip />
    <Line type="monotone" dataKey="spent" stroke="#8b5cf6" name="Spent" />
    <Line type="monotone" dataKey="saved" stroke="#10b981" name="Saved" />
  </LineChart>
</ResponsiveContainer>
```

### USDC 표시 변환

```typescript
function formatUsdc(amount: string): string {
  return `$${(Number(amount) / 1_000_000).toFixed(2)}`;
}
```

## 테스트 방법

```bash
# Backend + Dashboard 동시 실행
pnpm dev

# http://localhost:3001/dashboard 접속
# → 메트릭 카드 4개 표시
# → 비용 차트 렌더링
# → 엔드포인트 테이블 표시
# → 기간 변경 시 데이터 갱신
```

> Backend에 seed 데이터 + 몇 건의 requests가 있어야 의미 있는 데이터 표시됨.

## 완료 기준

- [x] 메트릭 카드 4개 (Total Requests, Cache Hit Rate, Avg Latency, Cache Savings)
- [x] 비용 시계열 차트 (recharts LineChart)
- [x] 엔드포인트 테이블 (Top 10)
- [x] 예산 사용량 표시
- [x] 기간 선택기 (1h, 24h, 7d, 30d)
- [x] 로컬에서 Dashboard 페이지 렌더링 확인
