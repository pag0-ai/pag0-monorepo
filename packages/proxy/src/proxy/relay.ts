/**
 * Transparent Relay Handler
 *
 * Unlike /proxy (which wraps 402 into JSON), /relay passes through
 * the raw upstream response so that x402 SDK clients can handle
 * the 402 → sign → retry flow automatically.
 *
 * Target URL comes from the X-Pag0-Target-URL header.
 * X-PAYMENT / PAYMENT-SIGNATURE headers are forwarded as-is.
 * Pag0 metadata is returned as X-Pag0-* response headers.
 */

import type { Context } from 'hono';
import { createHash } from 'node:crypto';
import { policyEngine } from '../policy/engine';
import { budgetTracker } from '../policy/budget';
import { cacheLayer } from '../cache/layer';
import { analyticsCollector } from '../analytics/collector';
import { erc8004Audit } from '../audit/erc8004';
import type { UsdcAmount } from '../types';

/** Headers to strip before forwarding to the upstream target */
const STRIP_HEADERS = new Set([
  'x-pag0-target-url',
  'x-pag0-api-key',
  'host',
  'connection',
  'content-length', // will be recalculated
]);

function extractHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function extractCost(response: Response): UsdcAmount {
  return (
    response.headers.get('x-cost') ||
    response.headers.get('x-payment-amount') ||
    '0'
  );
}

export async function handleRelay(c: Context): Promise<Response> {
  const startTime = Date.now();

  // ── 1. Extract target URL ────────────────────────────────
  const targetUrl = c.req.header('x-pag0-target-url');
  if (!targetUrl) {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'X-Pag0-Target-URL header is required' } },
      400,
    );
  }

  const projectId = c.get('projectId') as string;
  const endpoint = extractHostname(targetUrl);
  const method = c.req.method;

  // Read body once as ArrayBuffer (used for cache key + forwarding)
  const bodyBuf = method !== 'GET' && method !== 'HEAD'
    ? await c.req.arrayBuffer()
    : null;

  // ── 2. Policy check ──────────────────────────────────────
  const policyEval = await policyEngine.evaluate(
    { targetUrl, method, projectId },
    '0',
  );

  if (!policyEval.allowed) {
    const error: any = new Error(policyEval.details || 'Policy violation');
    error.code = policyEval.reason;
    error.name = 'PolicyViolationError';
    throw error;
  }

  // ── 3. Cache check (GET/HEAD only) ───────────────────────
  const bodyStr = bodyBuf ? Buffer.from(bodyBuf).toString() : undefined;
  const cacheKey = cacheLayer.generateKey(targetUrl, method, bodyStr);
  const cachedResponse = await cacheLayer.get(cacheKey);

  if (cachedResponse) {
    const latency = Date.now() - startTime;
    const budgetStatus = await budgetTracker.checkBudget(projectId);

    // Fire-and-forget analytics
    void analyticsCollector.record({
      projectId,
      endpoint,
      method,
      statusCode: 200,
      latencyMs: latency,
      cost: '0',
      cached: true,
      responseSize: JSON.stringify(cachedResponse).length,
      fullUrl: targetUrl,
      policyId: policyEval.policy.id,
      cacheKey,
    }).catch((err) => console.error('[Relay] Analytics error:', err));

    const cachedBody = JSON.stringify(cachedResponse);
    return new Response(cachedBody, {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'x-pag0-cost': '0',
        'x-pag0-cached': 'true',
        'x-pag0-latency': String(latency),
        'x-pag0-endpoint': endpoint,
        'x-pag0-budget-remaining': JSON.stringify({
          daily: String(BigInt(budgetStatus.dailyBudget) - BigInt(budgetStatus.dailySpent)),
          monthly: String(BigInt(budgetStatus.monthlyBudget) - BigInt(budgetStatus.monthlySpent)),
        }),
      },
    });
  }

  // ── 4. Build upstream request headers ────────────────────
  const upstreamHeaders = new Headers();
  c.req.raw.headers.forEach((value, key) => {
    if (!STRIP_HEADERS.has(key.toLowerCase())) {
      upstreamHeaders.set(key, value);
    }
  });

  // ── 5. Forward to upstream target ────────────────────────
  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(targetUrl, {
      method,
      headers: upstreamHeaders,
      body: bodyBuf,
      redirect: 'manual',
    });
  } catch (err) {
    return c.json(
      {
        error: {
          code: 'UPSTREAM_ERROR',
          message: `Failed to reach ${targetUrl}: ${err instanceof Error ? err.message : 'Unknown'}`,
        },
      },
      502,
    );
  }

  // ── 6. If 402 → pass through raw response ───────────────
  if (upstreamRes.status === 402) {
    const latency = Date.now() - startTime;

    // Clone upstream headers
    const resHeaders = new Headers();
    upstreamRes.headers.forEach((v, k) => resHeaders.set(k, v));

    // Add Pag0 metadata
    resHeaders.set('x-pag0-latency', String(latency));
    resHeaders.set('x-pag0-endpoint', endpoint);

    return new Response(upstreamRes.body, {
      status: 402,
      headers: resHeaders,
    });
  }

  // ── 7. Success path — read body, cache, analytics ────────
  const upstreamBody = await upstreamRes.arrayBuffer();
  const latency = Date.now() - startTime;
  const actualCost = extractCost(upstreamRes);

  // Try to parse as JSON for caching
  let parsedBody: any = null;
  const contentType = upstreamRes.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      parsedBody = JSON.parse(Buffer.from(upstreamBody).toString());
    } catch { /* not JSON, skip cache */ }
  }

  // Cache store
  const upstreamResHeaders: Record<string, string> = {};
  upstreamRes.headers.forEach((v, k) => { upstreamResHeaders[k] = v; });

  const shouldCache = parsedBody !== null && cacheLayer.isCacheable(
    { method, url: targetUrl },
    { status: upstreamRes.status, headers: upstreamResHeaders, body: parsedBody },
  );
  if (shouldCache) {
    await cacheLayer.set(cacheKey, parsedBody, targetUrl);
  }

  // Analytics (async fire-and-forget)
  void analyticsCollector.record({
    projectId,
    endpoint,
    method,
    statusCode: upstreamRes.status,
    latencyMs: latency,
    cost: actualCost,
    cached: false,
    responseSize: upstreamBody.byteLength,
    fullUrl: targetUrl,
    policyId: policyEval.policy.id,
    cacheKey: shouldCache ? cacheKey : undefined,
  }).catch((err) => console.error('[Relay] Analytics error:', err));

  // ERC-8004 audit (async fire-and-forget)
  void erc8004Audit.recordPaymentFeedback({
    agentId: endpoint,
    endpoint,
    cost: actualCost,
    latencyMs: latency,
    statusCode: upstreamRes.status,
    txHash: upstreamRes.headers.get('x-transaction-hash') || '',
    sender: '',
    receiver: endpoint,
  }).catch((err) => console.warn('[Relay] ERC-8004 audit error:', err));

  // Budget deduct
  if (actualCost !== '0') {
    await budgetTracker.recordSpend(projectId, actualCost);
  }

  const budgetStatus = await budgetTracker.checkBudget(projectId);

  // ── 8. Build response with raw body + metadata headers ───
  const resHeaders = new Headers();
  upstreamRes.headers.forEach((v, k) => resHeaders.set(k, v));

  resHeaders.set('x-pag0-cost', actualCost);
  resHeaders.set('x-pag0-cached', 'false');
  resHeaders.set('x-pag0-latency', String(latency));
  resHeaders.set('x-pag0-endpoint', endpoint);
  resHeaders.set('x-pag0-budget-remaining', JSON.stringify({
    daily: String(BigInt(budgetStatus.dailyBudget) - BigInt(budgetStatus.dailySpent)),
    monthly: String(BigInt(budgetStatus.monthlyBudget) - BigInt(budgetStatus.monthlySpent)),
  }));

  return new Response(upstreamBody, {
    status: upstreamRes.status,
    headers: resHeaders,
  });
}
