# TASK-13: Dashboard Metrics Visualization

| Item | Content |
|------|------|
| **Package** | `packages/dashboard` |
| **Estimated Time** | 1.5 hours |
| **Dependencies** | [TASK-12](./TASK-12-dashboard-layout.md), [TASK-08](./TASK-08-analytics-routes.md) |
| **Blocks** | None |

## Goal

Implement core metric cards, cost charts, and endpoint tables on the Dashboard main page.

## Implementation Files

### `app/dashboard/page.tsx`

**Layout Structure**:
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

### Data Sources (React Query)

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

### Components

1. **MetricCard** (4 cards) — Total Requests, Cache Hit Rate (%), Avg Latency (ms), Cache Savings ($)
2. **CostChart** — `recharts` LineChart (spent vs saved, time series)
3. **EndpointTable** — Top endpoints table (sortable)
4. **BudgetProgress** — Daily/Monthly budget usage progress bar
5. **PeriodSelector** — `1h | 24h | 7d | 30d` period selector

### CostChart Component

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

### USDC Display Conversion

```typescript
function formatUsdc(amount: string): string {
  return `$${(Number(amount) / 1_000_000).toFixed(2)}`;
}
```

## Testing Method

```bash
# Run Backend + Dashboard simultaneously
pnpm dev

# Navigate to http://localhost:3001/dashboard
# → 4 metric cards displayed
# → Cost chart rendered
# → Endpoint table displayed
# → Data refreshes when period changes
```

> Meaningful data display requires seed data + several requests in the Backend.

## Completion Criteria

- [x] 4 metric cards (Total Requests, Cache Hit Rate, Avg Latency, Cache Savings)
- [x] Cost time series chart (recharts LineChart)
- [x] Endpoint table (Top 10)
- [x] Budget usage display
- [x] Period selector (1h, 24h, 7d, 30d)
- [x] Verify Dashboard page renders locally
