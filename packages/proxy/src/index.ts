import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { authMiddleware } from './middleware/auth';
import { rateLimitMiddleware } from './middleware/rate-limit';
import { proxyCore } from './proxy/core';
import { handleRelay } from './proxy/relay';
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

// ─── 2.1 Agent Card (no auth required) ───────────────────
app.get('/.well-known/agent.json', (c) => {
  return c.json({
    name: 'Pag0',
    description:
      'Smart proxy for the x402 ecosystem — Spend Firewall, API Curation, and Smart Cache in one middleware layer.',
    version: '1.0.0',
    protocolVersion: '0.3.0',
    provider: {
      organization: 'Pag0',
      url: process.env.PAG0_PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 3000}`,
    },
    url: process.env.PAG0_PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 3000}`,
    defaultInputModes: ['application/json'],
    defaultOutputModes: ['application/json'],
    capabilities: {
      spendFirewall: true,
      apiCuration: true,
      smartCache: true,
      onChainAudit: true,
      x402Proxy: true,
      streaming: false,
    },
    skills: [
      {
        id: 'proxy',
        name: 'x402 Proxy',
        description: 'Relay requests to x402-enabled APIs with automatic 402 payment flow handling.',
      },
      {
        id: 'spend-firewall',
        name: 'Spend Firewall',
        description: 'Policy-based budget management — daily/monthly limits, whitelist/blacklist enforcement.',
      },
      {
        id: 'api-curation',
        name: 'API Curation',
        description: 'Score, rank, and recommend x402 API endpoints by cost, latency, and reliability.',
      },
      {
        id: 'smart-cache',
        name: 'Smart Cache',
        description: 'Intelligent response caching with TTL management for 40%+ cost reduction.',
      },
      {
        id: 'on-chain-audit',
        name: 'On-Chain Audit Trail',
        description: 'ERC-8004 reputation and validation events on SKALE (zero gas).',
      },
    ],
    authentication: {
      schemes: ['apiKey'],
      header: 'X-Pag0-API-Key',
    },
    network: {
      chain: 'base-sepolia',
      asset: 'USDC',
      auditChain: 'SKALE (bite-v2-sandbox)',
    },
  });
});

// ─── 2.2 LLMs.txt (no auth required) ──────────────────
app.get('/llms.txt', (c) => {
  const baseUrl = process.env.PAG0_PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
  return c.text(
    `# Pag0 Smart Proxy

> Smart proxy for the x402 ecosystem — Spend Firewall, API Curation, and Smart Cache in one middleware layer.

- Auth: \`X-Pag0-API-Key\` header (register via POST /api/auth/register)
- Network: Base Sepolia, USDC payments
- Audit trail: ERC-8004 on SKALE (zero gas)
- Base URL: ${baseUrl}

## Core API

- POST /proxy — Relay a request to an x402-enabled API. Body: \`{ targetUrl, method, headers?, body?, signedPayment? }\`. Returns the upstream response plus cost/cache metadata. On 402 the proxy returns payment requirements for the agent to sign.
- ALL /relay — Transparent x402 pass-through. Forwards the request as-is and streams the raw upstream response including 402 payment negotiation.

## Policy (Spend Firewall)

- GET /api/policies — List all policies for the authenticated project.
- POST /api/policies — Create a policy. Body: \`{ name, type, rules }\`. Types: budget, whitelist, blacklist.
- GET /api/policies/:id — Get a single policy by ID.
- PUT /api/policies/:id — Update a policy.
- DELETE /api/policies/:id — Delete a policy.

## Curation

- GET /api/curation/recommend?category=:cat — Recommend top endpoints for a category.
- GET /api/curation/compare?endpoints=:a,:b — Side-by-side comparison of endpoints.
- GET /api/curation/rankings?category=:cat — Ranked list within a category.
- GET /api/curation/categories — List all categories.
- GET /api/curation/score/:endpoint — Get the score breakdown (cost, latency, reliability) for one endpoint.

## Analytics

- GET /api/analytics/summary — Aggregate spending, request count, and cache hit rate.
- GET /api/analytics/endpoints — Per-endpoint breakdown.
- GET /api/analytics/costs — Cost time-series (query params: period, from, to).
- GET /api/analytics/cache — Cache performance metrics.

## Reputation (ERC-8004)

- POST /api/reputation/feedback — Submit on-chain feedback for an endpoint.
- GET /api/reputation/score/:endpoint — Read aggregated on-chain reputation score.

## Optional

- GET /health — Health check (no auth).
- GET /.well-known/agent.json — Machine-readable agent card (A2A protocol).
- POST /api/auth/register — Create account. Body: \`{ email, password }\`. Returns API key.
- POST /api/auth/login — Login. Returns JWT.
- GET /api/auth/me — Current user info.
`,
    200,
    { 'Content-Type': 'text/plain; charset=utf-8' },
  );
});

// ─── 3. Auth routes (no auth middleware — register/login are public) ──
app.route('/api/auth', authRoutes);

// ─── 4. Auth + Rate Limit middleware (applied to all routes below) ──
app.use('/proxy/*', authMiddleware);
app.use('/api/policies/*', authMiddleware);
app.use('/api/analytics/*', authMiddleware);
app.use('/api/curation/*', authMiddleware);
app.use('/api/smart-request/*', authMiddleware);
app.use('/api/reputation/*', authMiddleware);
app.use('/relay', authMiddleware);
app.use('/proxy/*', rateLimitMiddleware);
app.use('/api/policies/*', rateLimitMiddleware);
app.use('/api/analytics/*', rateLimitMiddleware);
app.use('/api/curation/*', rateLimitMiddleware);
app.use('/api/smart-request/*', rateLimitMiddleware);
app.use('/api/reputation/*', rateLimitMiddleware);
app.use('/relay', rateLimitMiddleware);

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

// ─── 5b. Transparent relay endpoint (raw 402 pass-through) ──
app.all('/relay', handleRelay);

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
