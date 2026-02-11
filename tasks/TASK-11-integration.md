# TASK-11: index.ts 통합 + 에러 핸들링

| 항목 | 내용 |
|------|------|
| **패키지** | `packages/proxy` |
| **예상 시간** | 1시간 |
| **의존성** | [TASK-02](./TASK-02-auth-middleware.md), [TASK-05](./TASK-05-proxy-core.md), [TASK-07~10](./TASK-07-policy-routes.md) |
| **차단 대상** | [TASK-16](./TASK-16-mcp-integration.md), [TASK-17](./TASK-17-e2e-test.md) |

## 목표

모든 미들웨어, 라우트, 에러 핸들러를 `index.ts`에 통합하여 완전한 Hono 서버를 완성한다.

## 구현 내용

### `packages/proxy/src/index.ts` 수정

현재 상태 (스켈레톤):
```typescript
// TODO: Add routes
// app.post('/proxy', proxyHandler)
// app.route('/api/policies', policyRoutes)
// ...
```

목표 상태:
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

// 2. Health check (인증 불필요)
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

// 3. Auth routes (인증 불필요)
app.route('/api/auth', authRoutes);

// 4. Auth + Rate Limit 미들웨어 (이후 모든 라우트에 적용)
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
  // 일반 에러
  console.error('Internal error:', err);
  return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } }, 500);
});
```

### 미들웨어 적용 순서

```
모든 요청 → CORS → 라우트 매칭
  /health → 바로 응답
  /api/auth/register, /api/auth/login → 바로 핸들러
  /proxy/*, /api/* → Auth → Rate Limit → 핸들러
```

## Graceful Shutdown

```typescript
process.on('SIGTERM', async () => {
  await redis.quit();
  await sql.end();
  process.exit(0);
});
```

## 테스트 방법

```bash
pnpm docker:up
pnpm dev:proxy

# 전체 서비스 점검
curl http://localhost:3000/health                                    # → 200
curl http://localhost:3000/api/policies                              # → 401
curl -H "X-Pag0-API-Key: wrong" http://localhost:3000/api/policies  # → 401
curl -H "X-Pag0-API-Key: {valid}" http://localhost:3000/api/policies # → 200
curl http://localhost:3000/nonexistent                               # → 404
```

## 완료 기준

- [ ] 모든 라우트 마운트 완료
- [ ] Auth 미들웨어 적용 (제외 경로 포함)
- [ ] Rate Limit 미들웨어 적용
- [ ] Global error handler (PolicyViolation, Unauthorized, RateLimit, Internal)
- [ ] 404 handler
- [ ] Graceful shutdown (Redis, PG 연결 종료)
- [ ] 로컬에서 전체 서비스 정상 동작 확인
