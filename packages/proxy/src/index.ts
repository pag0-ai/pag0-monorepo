import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { authMiddleware } from './middleware/auth';
import { rateLimitMiddleware } from './middleware/rate-limit';
import { proxyCore } from './proxy/core';
import policyRoutes from './routes/policies';
import analyticsRoutes from './routes/analytics';
import curationRoutes from './routes/curation';
import authRoutes from './routes/auth';
import smartRequestRoutes from './routes/smart-request';
import reputationRoutes from './routes/reputation';
import { PolicyViolationError, UnauthorizedError, RateLimitError } from './types/index';
import redis from './cache/redis';
import sql from './db/postgres';
import { erc8004Audit } from './audit/erc8004';

type Variables = {
  user: {
    id: string;
    email: string;
    tier: 'free' | 'pro' | 'enterprise';
  };
  projectId: string;
};

const app = new Hono<{ Variables: Variables }>();

// ─── 1. CORS ─────────────────────────────────────────────
app.use('/*', cors({ origin: process.env.CORS_ORIGINS?.split(',') ?? ['http://localhost:3001'] }));

// ─── 2. Health check (no auth required) ──────────────────
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ─── 3. Auth routes (no auth middleware — register/login are public) ──
app.route('/api/auth', authRoutes);

// ─── 4. Auth + Rate Limit middleware (applied to all routes below) ──
app.use('/proxy/*', authMiddleware);
app.use('/api/policies/*', authMiddleware);
app.use('/api/analytics/*', authMiddleware);
app.use('/api/curation/*', authMiddleware);
app.use('/api/smart-request/*', authMiddleware);
app.use('/api/reputation/*', authMiddleware);
app.use('/proxy/*', rateLimitMiddleware);
app.use('/api/policies/*', rateLimitMiddleware);
app.use('/api/analytics/*', rateLimitMiddleware);
app.use('/api/curation/*', rateLimitMiddleware);
app.use('/api/smart-request/*', rateLimitMiddleware);
app.use('/api/reputation/*', rateLimitMiddleware);

// ─── 5. Proxy endpoint ───────────────────────────────────
app.post('/proxy', async (c) => {
  const body = await c.req.json();
  const projectId = c.get('projectId') as string;

  // Validate required fields
  if (!body.targetUrl || typeof body.targetUrl !== 'string') {
    return c.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'targetUrl is required and must be a string',
        },
      },
      400,
    );
  }

  const result = await proxyCore.handleRequest({
    targetUrl: body.targetUrl,
    method: body.method || 'GET',
    headers: body.headers,
    body: body.body,
    projectId,
    signedPayment: body.signedPayment,
  });

  return c.json(result, result.status as any);
});

// ─── 6. API Routes ───────────────────────────────────────
app.route('/api/policies', policyRoutes);
app.route('/api/analytics', analyticsRoutes);
app.route('/api/curation', curationRoutes);
app.route('/api/smart-request', smartRequestRoutes);
app.route('/api/reputation', reputationRoutes);

// ─── 7. Global error handler ─────────────────────────────
app.onError((err, c) => {
  if (err instanceof PolicyViolationError) {
    return c.json(
      {
        error: {
          code: 'POLICY_VIOLATION',
          reason: err.code,
          message: err.message,
        },
      },
      403,
    );
  }

  if (err instanceof UnauthorizedError) {
    return c.json(
      {
        error: {
          code: 'UNAUTHORIZED',
          message: err.message,
        },
      },
      401,
    );
  }

  if (err instanceof RateLimitError) {
    return c.json(
      {
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: err.message,
          retryAfter: err.retryAfter,
        },
      },
      429,
    );
  }

  console.error('Internal error:', err);
  return c.json(
    {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
      },
    },
    500,
  );
});

// ─── 8. 404 handler ──────────────────────────────────────
app.notFound((c) => {
  return c.json(
    {
      error: {
        code: 'NOT_FOUND',
        message: `Route not found: ${c.req.method} ${c.req.path}`,
      },
    },
    404,
  );
});

// ─── 9. Graceful shutdown ────────────────────────────────
process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  erc8004Audit.shutdown();
  await redis.quit();
  await sql.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Shutting down...');
  erc8004Audit.shutdown();
  await redis.quit();
  await sql.end();
  process.exit(0);
});

const port = Number(process.env.PORT ?? 3000);
console.log(`Pag0 Proxy running on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};
