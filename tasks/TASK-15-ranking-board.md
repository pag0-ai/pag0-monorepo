# TASK-15: API Ranking Board

| Item | Content |
|------|------|
| **Package** | `packages/dashboard` |
| **Estimated Time** | 1 hour |
| **Dependencies** | [TASK-12](./TASK-12-dashboard-layout.md), [TASK-09](./TASK-09-curation-routes.md) |
| **Blocks** | None |

## Goal

Visualize API endpoint rankings by category, score comparison, and recommendations.

## Implementation Files

### `app/rankings/page.tsx`

**Layout**:
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

### Features

1. **Category Filter** — Dropdown (AI, Data, Blockchain, IoT, Finance, Social, Communication, Storage)
2. **Ranking Table** — Rank, endpoint, Overall/Cost/Latency/Reliability scores
3. **Score Badges** — Color coding (>80 green, 60-80 yellow, <60 red)
4. **Endpoint Comparison** — Select 2~5 endpoints and compare (side-by-side)
5. **Category Overview** — Number of endpoints per category, average score

### Data Source

```typescript
const { data: rankings } = useQuery({
  queryKey: ['rankings', category],
  queryFn: () => fetchRankings({ category }),
});

const { data: categories } = useQuery({
  queryKey: ['categories'],
  queryFn: fetchCategories,
});

// Comparison (on-demand)
const compareMutation = useMutation({
  mutationFn: (endpoints: string[]) =>
    fetchApi(`/api/curation/compare?endpoints=${endpoints.join(',')}`),
});
```

### Score Badge Component

```typescript
function ScoreBadge({ score }: { score: number }) {
  const color = score >= 80 ? 'text-green-400' : score >= 60 ? 'text-yellow-400' : 'text-red-400';
  return <span className={color}>{score}</span>;
}
```

## Testing Instructions

```bash
pnpm dev

# Access http://localhost:3001/rankings
# → Ranking table displayed based on seed data (5 endpoint_scores)
# → Filtering when category changes
# → Check score badge colors
# → Comparison feature works (select 2 → Compare)
```

## Completion Criteria

- [x] Category filter dropdown
- [x] Ranking table (rank + 4 scores)
- [x] Score badge color coding
- [x] Endpoint comparison feature
- [x] Category overview
- [x] Verify rendering based on seed data locally
