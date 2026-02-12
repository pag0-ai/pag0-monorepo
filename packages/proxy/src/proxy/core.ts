/**
 * Proxy Core - Main Orchestrator
 *
 * Implements 8-step request flow:
 * 1. Policy check (PolicyEngine.evaluate) → 403 on violation
 * 2. Cache check (CacheLayer.get) → return cached if hit
 * 3. Forward to x402 server (X402Integration.forwardRequest)
 * 4. If 402 → parse PaymentRequired, relay to agent
 * 5. If signedPayment in request → forward with payment
 * 6. Cache store (if isCacheable)
 * 7. Analytics log (async, fire-and-forget)
 * 8. Budget deduct (BudgetTracker.recordSpend)
 */

import { PolicyEngine, policyEngine } from '../policy/engine';
import { budgetTracker } from '../policy/budget';
import { cacheLayer } from '../cache/layer';
import { analyticsCollector } from '../analytics/collector';
import { erc8004Audit } from '../audit/erc8004';
import redis from '../cache/redis';
import { x402Integration } from './x402';
import type { ProxyRequest, UsdcAmount, PolicyViolationError } from '../types';

export interface ProxyCoreRequest extends ProxyRequest {
  signedPayment?: any; // Optional signed payment from agent
}

export interface ProxyCoreResponse {
  status: number;
  body: any;
  headers?: Record<string, string>;
  metadata: {
    cost: UsdcAmount;
    cached: boolean;
    cacheAge?: number; // seconds since cached
    latency: number; // ms
    endpoint: string;
    budgetRemaining: {
      daily: string;
      monthly: string;
    };
  };
}

export interface Payment402Response {
  status: 402;
  paymentInfo: {
    maxAmountRequired: string;
    resource: string;
    scheme: string;
    network: string;
    description?: string;
  };
  metadata: {
    endpoint: string;
    latency: number;
  };
}

export class ProxyCore {
  private policyEngine: PolicyEngine;

  constructor() {
    this.policyEngine = policyEngine;
  }

  /**
   * Main request handler - implements 8-step flow
   */
  async handleRequest(request: ProxyCoreRequest): Promise<ProxyCoreResponse | Payment402Response> {
    const startTime = Date.now();
    const endpoint = this.extractHostname(request.targetUrl);

    // Default estimated cost for policy check (will be updated with actual cost later)
    const estimatedCost: UsdcAmount = '0'; // Free for cache hits, will be updated

    // ─── Step 1: Policy Check ────────────────────────────────
    const policyEval = await this.policyEngine.evaluate(request, estimatedCost);

    if (!policyEval.allowed) {
      const error: any = new Error(policyEval.details || 'Policy violation');
      error.code = policyEval.reason;
      error.name = 'PolicyViolationError';
      throw error;
    }

    // ─── Step 2: Cache Check ─────────────────────────────────
    const cacheKey = cacheLayer.generateKey(
      request.targetUrl,
      request.method,
      request.body ? JSON.stringify(request.body) : undefined,
    );

    const cachedResponse = await cacheLayer.get(cacheKey);

    if (cachedResponse) {
      const latency = Date.now() - startTime;

      // Get cache age (TTL info from Redis)
      const cacheTTL = await redis.ttl(cacheKey);
      const cacheAge = cacheTTL > 0 ? (300 - cacheTTL) : undefined; // Assuming 300s default TTL

      // Get budget status for metadata
      const budgetStatus = await budgetTracker.checkBudget(request.projectId);

      // Fire-and-forget analytics (cached request, cost=0)
      void analyticsCollector.record({
        projectId: request.projectId,
        endpoint,
        method: request.method,
        statusCode: 200, // Assume cached responses are successful
        latencyMs: latency,
        cost: '0',
        cached: true,
        responseSize: JSON.stringify(cachedResponse).length,
        fullUrl: request.targetUrl,
        policyId: policyEval.policy.id,
        cacheKey,
      }).catch((err) => console.error('[ProxyCore] Analytics error:', err));

      return {
        status: 200,
        body: cachedResponse,
        metadata: {
          cost: '0',
          cached: true,
          cacheAge,
          latency,
          endpoint,
          budgetRemaining: {
            daily: budgetStatus.dailySpent,
            monthly: budgetStatus.monthlySpent,
          },
        },
      };
    }

    // ─── Step 3: Forward to x402 Server ──────────────────────
    const requestOptions: RequestInit = {
      method: request.method,
      headers: request.headers,
      body: request.body ? JSON.stringify(request.body) : undefined,
    };

    let response: Response;

    // ─── Step 5: If signedPayment present, forward with payment
    if (request.signedPayment) {
      // Check nonce for replay prevention
      const paymentId = request.signedPayment.id || request.signedPayment.nonce;
      if (paymentId) {
        const nonceKey = `nonce:${paymentId}`;
        const nonceExists = await redis.get(nonceKey);

        if (nonceExists) {
          const error: any = new Error('Payment already used (replay detected)');
          error.code = 'REPLAY_ATTACK';
          throw error;
        }

        // Set nonce with 1 hour TTL
        await redis.setex(nonceKey, 3600, '1');
      }

      response = await x402Integration.forwardWithPayment(
        request.targetUrl,
        requestOptions,
        request.signedPayment,
      );
    } else {
      response = await x402Integration.forwardRequest(request.targetUrl, requestOptions);
    }

    // ─── Step 4: If 402, parse and relay payment info ────────
    if (response.status === 402) {
      const paymentInfo = x402Integration.parsePaymentRequest(response);

      if (!paymentInfo) {
        throw new Error('Received 402 but could not parse payment info');
      }

      const latency = Date.now() - startTime;

      return {
        status: 402,
        paymentInfo,
        metadata: {
          endpoint,
          latency,
        },
      };
    }

    // ─── Parse response body ─────────────────────────────────
    let responseBody: any;
    const contentType = response.headers.get('content-type');

    try {
      if (contentType?.includes('application/json')) {
        responseBody = await response.json();
      } else if (contentType?.includes('text/')) {
        responseBody = await response.text();
      } else {
        // Binary/other - convert to base64
        const arrayBuffer = await response.arrayBuffer();
        responseBody = Buffer.from(arrayBuffer).toString('base64');
      }
    } catch (error) {
      responseBody = null;
    }

    const latency = Date.now() - startTime;

    // Extract cost from response headers (x402 convention)
    const actualCost = this.extractCostFromResponse(response);

    // ─── Step 6: Cache Store ─────────────────────────────────
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    const shouldCache = cacheLayer.isCacheable(
      { method: request.method, url: request.targetUrl },
      {
        status: response.status,
        headers: responseHeaders,
        body: responseBody,
      },
    );

    if (shouldCache) {
      await cacheLayer.set(cacheKey, responseBody, request.targetUrl);
    }

    // ─── Step 7: Analytics Log (async) ───────────────────────
    void analyticsCollector.record({
      projectId: request.projectId,
      endpoint,
      method: request.method,
      statusCode: response.status,
      latencyMs: latency,
      cost: actualCost,
      cached: false,
      responseSize: JSON.stringify(responseBody).length,
      fullUrl: request.targetUrl,
      policyId: policyEval.policy.id,
      cacheKey: shouldCache ? cacheKey : undefined,
    }).catch((err) => console.error('[ProxyCore] Analytics error:', err));

    // ─── Step 7b: ERC-8004 Audit (async, fire-and-forget) ───
    if (actualCost !== '0') {
      void erc8004Audit.recordPaymentFeedback({
        agentId: endpoint, // x402 server identity (hostname as fallback)
        endpoint,
        cost: actualCost,
        latencyMs: latency,
        statusCode: response.status,
        txHash: response.headers.get('x-transaction-hash') || '',
        sender: request.signedPayment?.sender || '',
        receiver: endpoint,
      }).catch((err) => console.warn('[ProxyCore] ERC-8004 audit error:', err));
    }

    // ─── Step 8: Budget Deduct ───────────────────────────────
    if (actualCost !== '0') {
      await budgetTracker.recordSpend(request.projectId, actualCost);
    }

    // Get updated budget status for response metadata
    const budgetStatus = await budgetTracker.checkBudget(request.projectId);

    // ─── Return Response ─────────────────────────────────────
    return {
      status: response.status,
      body: responseBody,
      headers: responseHeaders,
      metadata: {
        cost: actualCost,
        cached: false,
        latency,
        endpoint,
        budgetRemaining: {
          daily: budgetStatus.dailySpent,
          monthly: budgetStatus.monthlySpent,
        },
      },
    };
  }

  /**
   * Extract hostname from URL for analytics/policy matching
   */
  private extractHostname(url: string): string {
    try {
      const parsed = new URL(url);
      return parsed.hostname;
    } catch {
      return url;
    }
  }

  /**
   * Extract actual cost from x402 response headers
   *
   * x402 may include cost in headers like:
   * - X-Cost: <amount>
   * - X-Payment-Amount: <amount>
   *
   * Returns "0" if no cost header found (free endpoint)
   */
  private extractCostFromResponse(response: Response): UsdcAmount {
    // Try X-Cost header
    const costHeader = response.headers.get('X-Cost') || response.headers.get('x-cost');
    if (costHeader) {
      return costHeader;
    }

    // Try X-Payment-Amount header
    const paymentAmount = response.headers.get('X-Payment-Amount') || response.headers.get('x-payment-amount');
    if (paymentAmount) {
      return paymentAmount;
    }

    // Default to 0 (free)
    return '0';
  }
}

// Export singleton instance
export const proxyCore = new ProxyCore();
