# TASK-14: Policy Management UI

| Item | Content |
|------|------|
| **Package** | `packages/dashboard` |
| **Estimated Time** | 1 hour |
| **Dependencies** | [TASK-12](./TASK-12-dashboard-layout.md), [TASK-07](./TASK-07-policy-routes.md) |
| **Blocks** | None |

## Objective

Implement UI for listing, creating, updating, and deleting policies.

## Implementation Files

### `app/policies/page.tsx`

**Layout**:
```
┌─────────────────────────────────────────┐
│  Policies        [+ Create Policy]       │
├─────────────────────────────────────────┤
│ Name      | Daily | Monthly | Status | ⋯│
│ Production| $10   | $100    | Active | ✏️🗑️│
│ Dev       | $5    | $50     | Inactive| ✏️🗑️│
└─────────────────────────────────────────┘
```

### Features

1. **Policy List Table** — Name, daily budget, monthly budget, active status, edit/delete buttons
2. **Policy Creation Modal/Form** — Name, maxPerRequest, dailyBudget, monthlyBudget, allowedEndpoints, blockedEndpoints
3. **Policy Edit** — Inline or modal
4. **Policy Delete** — Soft delete after confirmation dialog

### Data Source

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

### USDC Input Handling

Users enter dollar amounts ($1.00), internally converted to BIGINT:
```typescript
// Input: "10" (dollars) → Store: "10000000" (USDC 6 decimals)
const toUsdcBigint = (dollars: string) => String(Math.floor(parseFloat(dollars) * 1_000_000));
const fromUsdcBigint = (usdc: string) => (Number(usdc) / 1_000_000).toFixed(2);
```

### Endpoint Input

Allowed/Blocked endpoints are comma-separated text input:
```
api.openai.com, *.anthropic.com
```

## Testing Method

```bash
pnpm dev

# Navigate to http://localhost:3001/policies
# → Display existing policy list
# → Click "Create Policy" → Fill form → Save
# → New policy appears in list
# → Verify edit/delete actions
```

## Completion Criteria

- [x] Policy list table implemented
- [x] Policy creation form (with USDC conversion)
- [x] Policy edit functionality
- [x] Policy delete functionality (with confirmation)
- [x] Full CRUD flow verified locally
