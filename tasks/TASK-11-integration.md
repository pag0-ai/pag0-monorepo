# TASK-11: index.ts Integration + Error Handling

| Item | Content |
|------|------|
| **Package** | `packages/proxy` |
| **Estimated Time** | 1 hour |
| **Dependencies** | [TASK-02](./TASK-02-auth-middleware.md), [TASK-05](./TASK-05-proxy-core.md), [TASK-07~10](./TASK-07-policy-routes.md) |
| **Blocks** | [TASK-16](./TASK-16-mcp-integration.md), [TASK-17](./TASK-17-e2e-test.md) |

## Objective

Integrate all middleware, routes, and error handlers into `index.ts` to complete a fully functional Hono server.

## Implementation

### Modify `packages/proxy/src/index.ts`

Current state (skeleton):
```typescript
// TODO: Add routes
// app.post('/proxy', proxyHandler)
// app.route('/api/policies', policyRoutes)
// ...
```

Target state:
```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { authMiddleware } from './middleware/auth';
import { rateLimitMiddleware } from './middleware/rate-limit';
import { proxyHandler } from './proxy/core';
import policyRoutes from './routes/policies';
import analyticsRoutes from './routes/analytics';
import curationRoutes from './routes/curation';
import authRoutes from './routes/auth';

const app = new Hono();

// 1. CORS
app.use('/*', cors({ origin: process.env.CORS_ORIGINS?.split(',') ?? ['http://localhost:3001'] }));

// 2. Health check (no auth required)
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

// 3. Auth routes (no auth required)
app.route('/api/auth', authRoutes);

// 4. Auth + Rate Limit middleware (apply to all subsequent routes)
app.use('/proxy/*', authMiddleware);
app.use('/api/*', authMiddleware);
app.use('/proxy/*', rateLimitMiddleware);
app.use('/api/*', rateLimitMiddleware);

// 5. Routes
app.post('/proxy', proxyHandler);
app.route('/api/policies', policyRoutes);
app.route('/api/analytics', analyticsRoutes);
app.route('/api/curation', curationRoutes);

// 6. Global error handler
app.onError((err, c) => { ... });

// 7. 404 handler
app.notFound((c) => { ... });
```

### Global Error Handler

```typescript
app.onError((err, c) => {
  if (err instanceof PolicyViolationError) {
    return c.json({ error: { code: 'POLICY_VIOLATION', reason: err.code, message: err.message } }, 403);
  }
  if (err instanceof UnauthorizedError) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: err.message } }, 401);
  }
  if (err instanceof RateLimitError) {
    return c.json({ error: { code: 'RATE_LIMIT_EXCEEDED', message: err.message, details: { resetAt: ... } } }, 429);
  }
  // General error
  console.error('Internal error:', err);
  return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } }, 500);
});
```

### Middleware Application Order

```
All requests → CORS → Route matching
  /health → immediate response
  /api/auth/register, /api/auth/login → direct handler
  /proxy/*, /api/* → Auth → Rate Limit → handler
```

## Graceful Shutdown

```typescript
process.on('SIGTERM', async () => {
  await redis.quit();
  await sql.end();
  process.exit(0);
});
```

## Testing Method

```bash
pnpm docker:up
pnpm dev:proxy

# Full service check
curl http://localhost:3000/health                                    # → 200
curl http://localhost:3000/api/policies                              # → 401
curl -H "X-Pag0-API-Key: wrong" http://localhost:3000/api/policies  # → 401
curl -H "X-Pag0-API-Key: {valid}" http://localhost:3000/api/policies # → 200
curl http://localhost:3000/nonexistent                               # → 404
```

## Completion Criteria

- [x] All routes mounted successfully
- [x] Auth middleware applied (including excluded paths)
- [x] Rate Limit middleware applied
- [x] Global error handler (PolicyViolation, Unauthorized, RateLimit, Internal)
- [x] 404 handler
- [x] Graceful shutdown (Redis, PG connection termination)
- [x] Full service verified working locally
