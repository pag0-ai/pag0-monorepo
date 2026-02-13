# TASK-01: DB/Redis Client Setup

| Item | Content |
|------|------|
| **Package** | `packages/proxy` |
| **Estimated Time** | 30 minutes |
| **Dependencies** | None (highest priority task) |
| **Blocks** | [TASK-02](./TASK-02-auth-middleware.md), [TASK-03](./TASK-03-policy-engine.md), [TASK-04](./TASK-04-cache-layer.md), [TASK-06](./TASK-06-analytics-collector.md), [TASK-07~10](./TASK-00-OVERVIEW.md) |

## Objective

Set up PostgreSQL and Redis clients as singletons so they can be imported and used across all modules.

## Implementation Files

### 1. `packages/proxy/src/db/postgres.ts`

```typescript
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!, {
  max: 20,              // connection pool
  idle_timeout: 30,
  connect_timeout: 10,
  transform: {
    undefined: null,
  },
});

export default sql;
```

### 2. `packages/proxy/src/cache/redis.ts`

```typescript
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL!, {
  tls: process.env.REDIS_URL?.startsWith('rediss://') ? {} : undefined,
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    return Math.min(times * 50, 2000);
  },
});

export default redis;
```

## Environment Variables

Values that should already exist in `.env.local`:
- `DATABASE_URL` — Supabase PostgreSQL (or local Docker)
- `REDIS_URL` — Upstash Redis (or local Docker)

> **Note**: Check the variable names in existing `.env.local` file and be careful about `POSTGRES_URL` vs `DATABASE_URL` differences.

## Testing Method

```bash
# Run local Docker environment (already configured)
pnpm docker:up

# Simple connection verification (refer to prepare-hackathon tests)
cd packages/proxy && bun run src/db/postgres.ts
```

- Redis: `redis.ping()` → `PONG`
- PostgreSQL: `sql`SELECT 1`` → `[{ '?column?': 1 }]`

## References

- `prepare-hackathon/test-redis.ts` — Redis connection pattern
- `prepare-hackathon/test-postgres.ts` — PostgreSQL connection pattern
- `prepare-hackathon/DAY0-FINDINGS.md` — Precautions for TLS, BIGINT return values, etc.

## Completion Criteria

- [x] `postgres.ts` written and importable
- [x] `redis.ts` written and importable
- [x] Connection verified successfully in local Docker environment
