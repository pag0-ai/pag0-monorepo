# TASK-02: Auth Middleware + Rate Limiter

| Item | Content |
|------|------|
| **Package** | `packages/proxy` |
| **Estimated Time** | 1 hour |
| **Dependencies** | [TASK-01](./TASK-01-db-redis-client.md) |
| **Blocks** | [TASK-11](./TASK-11-integration.md) |

## Objective

Implement API Key authentication and Rate Limiting as Hono middleware. Apply to all `/proxy`, `/api/*` endpoints.

## Implementation Files

### 1. Auth Middleware: `packages/proxy/src/middleware/auth.ts`

**Features**:
- Extract API Key from `X-Pag0-API-Key` header
- Hash with SHA-256 and query `users` table
- Store in context as `c.set('user', user)`, `c.set('project', project)`
- Throw `UnauthorizedError` (401) on authentication failure

**API Key Hashing**:
```typescript
import { createHash } from 'crypto';
const hash = createHash('sha256').update(apiKey).digest('hex');
```

**DB Query**:
```sql
SELECT u.id, u.email, u.subscription_tier, p.id as project_id
FROM users u
JOIN projects p ON p.user_id = u.id AND p.is_active = true
WHERE u.api_key_hash = $1
LIMIT 1
```

### 2. Rate Limiter: `packages/proxy/src/middleware/rate-limit.ts`

**Features**:
- Redis INCR + TTL (1-minute window)
- Key pattern: `rate:{projectId}:{minute_window}`
- Free tier: 60 req/min, Pro tier: 1000 req/min
- Throw `RateLimitError` (429) + `X-RateLimit-*` headers on limit exceeded

**Response Headers** (all responses):
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 42
X-RateLimit-Reset: 1707580800
```

## Test Patterns

Refer to `prepare-hackathon/test-business-logic-day1.ts`:
- **Test 5 (Rate Limiter)**: Redis INCR pattern, TTL setting, block after 60 requests
- **Test 7 (API Key Auth)**: SHA-256 hashing, DB query, reject invalid keys

## Test Method

```bash
# After starting the server
curl -H "X-Pag0-API-Key: pag0_live_xxx" http://localhost:3000/health
# → 200 OK (endpoint doesn't require auth)

curl http://localhost:3000/api/policies
# → 401 Unauthorized

curl -H "X-Pag0-API-Key: {seeded demo key}" http://localhost:3000/api/policies
# → 200 OK
```

## Important Notes

- `/health` endpoint is exempt from authentication
- `/api/auth/register`, `/api/auth/login` are exempt from authentication (public endpoints)
- Never log/store API Key plaintext (hash only)
- Rate limit key TTL: 60 seconds (fixed)

## Completion Criteria

- [x] Auth middleware implementation (SHA-256 API Key authentication)
- [x] Rate Limiter implementation (Redis, tier-based limits)
- [x] Add `X-RateLimit-*` response headers
- [x] Handle auth-exempt paths (`/health`, `/api/auth/register`, `/api/auth/login`)
- [x] Test authentication success/failure locally with curl

## Bug Fix History

- **auth.ts SQL alias fix**: `p.id as project_id` → `p.id as "projectId"`. The `postgres` library does not automatically convert snake_case → camelCase, causing `user.projectId` to be set as `undefined`. This caused `project_id = null` errors in downstream routes (policies, analytics).
