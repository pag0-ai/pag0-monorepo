# TASK-07: Policy CRUD Routes

| Item | Content |
|------|------|
| **Package** | `packages/proxy` |
| **Estimated Time** | 1 hour |
| **Dependencies** | [TASK-01](./TASK-01-db-redis-client.md), [TASK-03](./TASK-03-policy-engine.md) |
| **Blocks** | [TASK-11](./TASK-11-integration.md), [TASK-14](./TASK-14-policy-ui.md) |

## Goal

Implement Policy CRUD API endpoints as Hono routes.

## Implementation Files

### `packages/proxy/src/routes/policies.ts`

Implement as Hono sub-app, mount in `index.ts` as `app.route('/api/policies', policyRoutes)`.

### Endpoint List

| Method | Path | Description | Response |
|--------|------|------|------|
| GET | `/` | List all policies for a project | `{ policies: Policy[], total: number }` |
| POST | `/` | Create new policy | `{ policy: Policy }` (201) |
| GET | `/:id` | Get policy details | `{ policy: Policy }` |
| PUT | `/:id` | Update policy (partial update) | `{ policy: Policy }` |
| DELETE | `/:id` | Delete policy (soft delete: is_active=false) | 204 No Content |

### GET `/` — List

```sql
SELECT * FROM policies
WHERE project_id = $1
ORDER BY created_at DESC
```

Query parameters: `projectId` (optional — leverage project context from middleware)

### POST `/` — Create

**Request body**:
```typescript
{
  name: string;
  maxPerRequest: string;      // USDC BIGINT
  dailyBudget: string;
  monthlyBudget: string;
  allowedEndpoints?: string[];
  blockedEndpoints?: string[];
}
```

**Validation**:
- `maxPerRequest <= dailyBudget <= monthlyBudget` (also guaranteed by DB constraints)
- Name required
- USDC amounts must be positive

**Note**: Only one active policy per project (`idx_policies_project_active_unique`). When creating a new policy, deactivate existing active policies.

### PUT `/:id` — Update

Supports partial update — only update provided fields. DB `updated_at` auto-updates.

### DELETE `/:id` — Delete

Soft delete: change to `is_active = false`. Do not delete actual rows.

## API Spec Reference

See `docs/04-API-SPEC.md` Section 2 (Policy Management).

## Error Response Format

```typescript
{
  error: {
    code: string;       // "INVALID_REQUEST", "NOT_FOUND"
    message: string;
    details?: any;
  }
}
```

## Testing Method

```bash
pnpm dev:proxy

# List
curl -H "X-Pag0-API-Key: {key}" http://localhost:3000/api/policies

# Create
curl -X POST -H "X-Pag0-API-Key: {key}" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","maxPerRequest":"1000000","dailyBudget":"10000000","monthlyBudget":"100000000"}' \
  http://localhost:3000/api/policies

# Update
curl -X PUT -H "X-Pag0-API-Key: {key}" \
  -H "Content-Type: application/json" \
  -d '{"dailyBudget":"20000000"}' \
  http://localhost:3000/api/policies/{id}

# Delete
curl -X DELETE -H "X-Pag0-API-Key: {key}" \
  http://localhost:3000/api/policies/{id}
```

## Completion Criteria

- [x] Implement 5 CRUD endpoints
- [x] Input validation (positive budgets, hierarchical order)
- [x] Handle 1 active policy per project limit
- [x] Implement soft delete
- [x] Pass local curl CRUD tests

## Bug Fix History

- **Complete SQL column name fixes in policies.ts**: Fixed `daily_limit`/`monthly_limit` → `daily_budget`/`monthly_budget` in SELECT, INSERT, UPDATE, RETURNING clauses (~15 occurrences). This mismatch with DB schema was causing all CRUD queries to fail.
- **TypeScript type mapping fixes**: Changed `row.daily_limit` → `row.daily_budget`, `row.monthly_limit` → `row.monthly_budget`.
