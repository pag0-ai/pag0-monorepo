# TASK-12: Dashboard Layout + Navigation

| Item | Content |
|------|------|
| **Package** | `packages/dashboard` |
| **Estimated Time** | 1 hour |
| **Dependencies** | None (can start independently) |
| **Blocks** | [TASK-13](./TASK-13-dashboard-metrics.md), [TASK-14](./TASK-14-policy-ui.md), [TASK-15](./TASK-15-ranking-board.md) |

## Goal

Configure Next.js Dashboard layout, navigation, API client, and React Query Provider.

## Current State

- `app/layout.tsx` — Minimal layout (dark theme)
- `app/page.tsx` — "Pag0 Dashboard" text only
- `lib/api.ts` — Basic fetchApi helper (16 lines)
- No components, no routes

## Implementation Details

### 1. React Query Provider — `app/providers.tsx`

```typescript
'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

export function Providers({ children }) { ... }
```

Wrap with `<Providers>` in `layout.tsx`.

### 2. API Client Extension — `lib/api.ts`

Add API Key header to existing `fetchApi`:
```typescript
headers: {
  'Content-Type': 'application/json',
  'X-Pag0-API-Key': getApiKey(),  // localStorage or env
  ...options?.headers,
}
```

Add convenience functions:
- `fetchAnalyticsSummary(period)`
- `fetchAnalyticsEndpoints(params)`
- `fetchAnalyticsCosts(params)`
- `fetchAnalyticsCache(period)`
- `fetchPolicies()`
- `fetchRankings(params)`
- `fetchCategories()`

### 3. Sidebar Navigation — `components/sidebar.tsx`

```
Pag0 Dashboard
├── Dashboard    (/dashboard)     — BarChart3 icon
├── Policies     (/policies)      — Shield icon
├── Rankings     (/rankings)      — Trophy icon
└── Settings     (/settings)      — Settings icon (optional)
```

Icons: `lucide-react` (already installed)
Style: Tailwind dark theme (`bg-gray-900`, `text-gray-100`)

### 4. Page Route Creation

```
app/
├── layout.tsx          — Providers + Sidebar wrapping
├── page.tsx            — / → /dashboard redirect
├── dashboard/
│   └── page.tsx        — Metrics dashboard (TASK-13)
├── policies/
│   └── page.tsx        — Policy management (TASK-14)
└── rankings/
    └── page.tsx        — API rankings (TASK-15)
```

Each page is created as an empty skeleton (to be filled in TASK-13~15).

### 5. Common Components

- `components/metric-card.tsx` — Number card (icon + title + value)
- `components/loading.tsx` — Skeleton loader

## Environment Variables

`packages/dashboard/.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:3000
```

## Testing Method

```bash
pnpm dev:dashboard
# → Access http://localhost:3001
# → Check sidebar navigation
# → Verify each route navigation
```

## Completion Criteria

- [x] React Query Provider setup
- [x] API client functions added (with API Key header)
- [x] Sidebar navigation implemented (3 menus)
- [x] 3 page routes created (skeleton)
- [x] MetricCard common component
- [x] Local Dashboard access + navigation functionality verified
