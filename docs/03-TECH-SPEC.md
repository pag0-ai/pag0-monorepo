# Pag0 Smart Proxy - Technical Specification

> **TL;DR**: An Edge-first architecture based on Hono + Bun runtime, composed of 5 core components: Proxy Core / Policy Engine / Curation Engine / Cache Layer / Analytics Collector. Supports 40%+ cost savings through Redis (Upstash) caching, PostgreSQL (Supabase) analytics storage, and SKALE on-chain metrics, with a P95 API response target of under 300ms.

## Related Documents

| Document | Relevance |
|----------|-----------|
| [04-API-SPEC.md](04-API-SPEC.md) | API endpoint definitions |
| [05-DB-SCHEMA.md](05-DB-SCHEMA.md) | Database schema details |
| [06-DEV-TASKS.md](06-DEV-TASKS.md) | Development tasks and implementation order |
| [10-SECURITY-DESIGN.md](10-SECURITY-DESIGN.md) | Security design details |
| [00-GLOSSARY.md](00-GLOSSARY.md) | Glossary |

## 1. System Architecture

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          AI Agent Application                        │
│                      (Virtuals G.A.M.E., Google ADK)                 │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             │ x402 Request (via Pag0 SDK)
                             ↓
┌─────────────────────────────────────────────────────────────────────┐
│                         Pag0 Smart Proxy API                         │
│                      (Hono + Bun/Node.js Runtime)                    │
├─────────────────────────────────────────────────────────────────────┤
│  ┌───────────────┐  ┌────────────────┐  ┌──────────────────────┐   │
│  │ Auth          │  │ Rate Limiter   │  │ Request Validator    │   │
│  │ Middleware    │  │                │  │                      │   │
│  └───────────────┘  └────────────────┘  └──────────────────────┘   │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ↓
         ┌───────────────────┴──────────────────────┐
         │                                           │
         ↓                                           ↓
┌─────────────────────┐                  ┌──────────────────────────┐
│  Policy Engine      │                  │   Cache Layer            │
│  - Budget Check     │                  │   - Redis (Upstash)      │
│  - Whitelist/       │                  │   - TTL Management       │
│    Blacklist        │                  │   - Key Generation       │
│  - Approval Flow    │                  │   - Cache Invalidation   │
└──────────┬──────────┘                  └──────────┬───────────────┘
           │                                        │
           │ Policy OK                              │ Cache MISS
           ↓                                        │
┌─────────────────────────────────────────────────┐│
│          Proxy Core (x402 Integration)          ││
│  ┌─────────────────────────────────────────┐   ││
│  │ 1. Forward request to x402 server        │   ││
│  │ 2. Receive 402 + PaymentRequest         │   ││
│  │ 3. Relay to Agent (Pag0 does NOT sign)  │   ││
│  │ 4. Agent signs payment                   │   ││
│  │ 5. Forward signed payment to Facilitator│   ││
│  │ 6. Relay response to Agent               │   ││
│  └─────────────────────────────────────────┘   ││
└──────────────────────┬──────────────────────────┘│
                       │                            │
                       ↓                            │
           ┌───────────────────────┐                │
           │   x402 Server         │                │
           │   + Facilitator       │                │
           └───────────┬───────────┘                │
                       │                            │
                       │ Response                   │
                       ↓                            │
┌──────────────────────────────────────────────────┴─────────────────┐
│                    Post-Processing Pipeline                         │
│  ┌──────────────┐ ┌─────────────┐ ┌──────────────┐ ┌───────────┐ │
│  │ Cache Store  │ │ Analytics   │ │ Budget Update│ │ ERC-8004  │ │
│  │ (if cache-   │ │ Logger      │ │              │ │ Feedback  │ │
│  │  able)       │ │             │ │              │ │ (on-chain)│ │
│  └──────────────┘ └─────────────┘ └──────────────┘ └───────────┘ │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                              ↓
                    ┌─────────────────────┐
                    │  Agent ← Response   │
                    │  + Metadata         │
                    │  (cost, cache info) │
                    └─────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                      Data Storage & Analytics                        │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │ PostgreSQL       │  │ Redis            │  │ SKALE Blockchain │  │
│  │ (Supabase)       │  │ (Upstash)        │  │ + ERC-8004       │  │
│  │                  │  │                  │  │                  │  │
│  │ - Policies       │  │ - Cache          │  │ - On-chain       │  │
│  │ - Requests Log   │  │ - Budget Counter │  │   Metrics        │  │
│  │ - Analytics      │  │ - Rate Limits    │  │ - ERC-8004       │  │
│  │ - Endpoint       │  │ - Scores Cache   │  │   Audit Trail    │  │
│  │   Scores         │  │                  │  │                  │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                      Curation & Indexing                             │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │ Curation Engine  │  │ The Graph        │  │ Dashboard UI     │  │
│  │                  │  │ (Subgraph)       │  │ (React/Next.js)  │  │
│  │ - Score Calc     │  │                  │  │                  │  │
│  │ - Recommend      │  │ - Payment Events │  │ - Metrics View   │  │
│  │ - Compare        │  │ - Cost Indexing  │  │ - Policy Mgmt    │  │
│  │ - Rankings       │  │                  │  │ - API Rankings   │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Cloudflare Workers / Fly.io                  │
│                      (Edge Deployment - Global)                  │
├─────────────────────────────────────────────────────────────────┤
│  Regions: us-east, us-west, eu-west, ap-southeast               │
│  Auto-scaling: 0 → 1000+ instances                              │
│  Latency: <50ms (99th percentile)                               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      Upstash Redis (Global)                      │
│  - Multi-region replication                                      │
│  - <5ms latency (regional)                                       │
│  - Serverless pricing                                            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                   Supabase PostgreSQL (Primary)                  │
│  - Multi-zone availability                                       │
│  - Auto-backup (hourly)                                          │
│  - Read replicas (analytics)                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Component Details

### 2.1 Proxy Core

**Responsibility**: x402 request relay and payment process orchestration

#### 2.1.1 Request Flow

```typescript
interface ProxyRequest {
  targetUrl: string;           // x402 server URL
  method: "GET" | "POST" | "PUT" | "DELETE";
  headers?: Record<string, string>;
  body?: any;
  cacheBypass?: boolean;       // Force fresh request
  metadata?: {
    projectId: string;
    policyId?: string;
  };
}

interface ProxyResponse {
  status: number;
  headers: Record<string, string>;
  body: any;
  metadata: {
    cost: string;              // USDC amount (6 decimals)
    cached: boolean;
    cacheAge?: number;         // seconds
    latency: number;           // milliseconds
    endpoint: string;
    budgetRemaining: {
      daily: string;
      monthly: string;
    };
  };
}
```

#### 2.1.2 Proxy Core Logic

```typescript
class ProxyCore {
  async handleRequest(req: ProxyRequest): Promise<ProxyResponse> {
    // 1. Policy Check
    const policyResult = await this.policyEngine.evaluate(req);
    if (!policyResult.allowed) {
      throw new PolicyViolationError(policyResult.reason);
    }

    // 2. Cache Check
    const cacheKey = this.generateCacheKey(req);
    if (!req.cacheBypass) {
      const cached = await this.cacheLayer.get(cacheKey);
      if (cached) {
        await this.analytics.logCacheHit(req);
        return this.buildResponse(cached, { cached: true });
      }
    }

    // 3. Forward to x402 server
    const x402Response = await this.forwardToX402(req.targetUrl, req);

    // 4. Handle 402 Payment Required
    if (x402Response.status === 402) {
      const paymentRequest = this.parsePaymentRequest(x402Response);

      // IMPORTANT: Proxy does NOT sign payment
      // Return 402 to Agent for signing
      return {
        status: 402,
        headers: x402Response.headers,
        body: paymentRequest,
        metadata: {
          cost: paymentRequest.amount,
          cached: false,
          latency: 0,
          endpoint: req.targetUrl,
          budgetRemaining: await this.getBudgetRemaining(req.metadata.projectId)
        }
      };
    }

    // 5. If Agent provides signed payment, forward to Facilitator
    if (req.signedPayment) {
      const verifiedResponse = await this.facilitator.verify(req.signedPayment);

      // 6. Cache response (if cacheable)
      if (this.isCacheable(verifiedResponse)) {
        await this.cacheLayer.set(cacheKey, verifiedResponse);
      }

      // 7. Log analytics
      await this.analytics.logRequest({
        endpoint: req.targetUrl,
        method: req.method,
        statusCode: verifiedResponse.status,
        cost: req.signedPayment.amount,
        cached: false,
        latency: Date.now() - startTime
      });

      // 8. Update budget
      await this.budgetTracker.deduct(
        req.metadata.projectId,
        req.signedPayment.amount
      );

      return this.buildResponse(verifiedResponse, { cached: false });
    }

    // Fallback: non-payment response
    return this.buildResponse(x402Response, { cached: false });
  }

  private generateCacheKey(req: ProxyRequest): string {
    // Hash: URL + Method + Body (for POST/PUT)
    const content = req.method === "GET"
      ? `${req.targetUrl}:${req.method}`
      : `${req.targetUrl}:${req.method}:${JSON.stringify(req.body)}`;

    return `cache:${crypto.createHash('sha256').update(content).digest('hex')}`;
  }

  private isCacheable(response: any): boolean {
    // Cacheable conditions:
    // - 2xx status
    // - GET or idempotent methods
    // - No Cache-Control: no-store
    // - Response size < maxCacheSizeBytes
    return response.status >= 200
      && response.status < 300
      && !response.headers['cache-control']?.includes('no-store')
      && JSON.stringify(response.body).length < this.config.maxCacheSizeBytes;
  }
}
```

#### 2.1.3 x402 SDK Integration

```typescript
import { X402Client } from '@x402/fetch';

class X402Integration {
  private client: X402Client;

  constructor(config: { facilitatorUrl: string }) {
    this.client = new X402Client({
      facilitatorUrl: config.facilitatorUrl
    });
  }

  async forwardRequest(url: string, options: RequestOptions) {
    // Use x402 SDK for 402 handling
    return await this.client.fetch(url, options);
  }

  parsePaymentRequest(response: Response): PaymentRequest {
    // Parse 402 response headers
    const paymentHeader = response.headers.get('X-Payment-Request');
    return JSON.parse(paymentHeader);
  }
}
```

---

### 2.2 Policy Engine (Spend Firewall)

**Responsibility**: Validation of budget limits, whitelists/blacklists, and approval workflows

#### 2.2.1 Policy Schema

```typescript
interface SpendPolicy {
  id: string;
  projectId: string;
  name: string;
  isActive: boolean;

  // Budget limits (USDC, 6 decimals)
  maxPerRequest: string;      // e.g., "1000000" = 1 USDC
  dailyBudget: string;        // e.g., "10000000" = 10 USDC
  monthlyBudget: string;      // e.g., "100000000" = 100 USDC

  // Endpoint filtering
  allowedEndpoints: string[]; // ["api.example.com", "*.openai.com"]
  blockedEndpoints?: string[];

  // Approval workflow
  requireApproval?: {
    threshold: string;        // Amount requiring approval
    webhookUrl: string;       // Webhook for approval requests
    timeoutSeconds: number;   // Auto-reject after timeout
  };

  // Anomaly detection
  anomalyDetection?: {
    enabled: boolean;
    maxDeviationPercent: number;  // e.g., 200 = 2x normal
    alertWebhook: string;
  };

  createdAt: Date;
  updatedAt: Date;
}
```

#### 2.2.2 Policy Evaluation Logic

```typescript
class PolicyEngine {
  async evaluate(req: ProxyRequest): Promise<PolicyEvaluation> {
    const policy = await this.getActivePolicy(req.metadata.projectId);

    // 1. Endpoint whitelist/blacklist check
    if (!this.isEndpointAllowed(req.targetUrl, policy)) {
      return {
        allowed: false,
        reason: "ENDPOINT_BLOCKED",
        details: `Endpoint ${req.targetUrl} not in allowlist`
      };
    }

    // 2. Per-request limit check
    const estimatedCost = await this.estimateCost(req);
    if (BigInt(estimatedCost) > BigInt(policy.maxPerRequest)) {
      return {
        allowed: false,
        reason: "PER_REQUEST_LIMIT_EXCEEDED",
        details: `Cost ${estimatedCost} exceeds limit ${policy.maxPerRequest}`
      };
    }

    // 3. Daily budget check
    const dailySpent = await this.budgetTracker.getDailySpent(req.metadata.projectId);
    if (BigInt(dailySpent) + BigInt(estimatedCost) > BigInt(policy.dailyBudget)) {
      return {
        allowed: false,
        reason: "DAILY_BUDGET_EXCEEDED",
        details: `Would exceed daily budget: ${dailySpent} + ${estimatedCost} > ${policy.dailyBudget}`
      };
    }

    // 4. Monthly budget check
    const monthlySpent = await this.budgetTracker.getMonthlySpent(req.metadata.projectId);
    if (BigInt(monthlySpent) + BigInt(estimatedCost) > BigInt(policy.monthlyBudget)) {
      return {
        allowed: false,
        reason: "MONTHLY_BUDGET_EXCEEDED",
        details: `Would exceed monthly budget`
      };
    }

    // 5. Approval workflow check
    if (policy.requireApproval && BigInt(estimatedCost) > BigInt(policy.requireApproval.threshold)) {
      const approved = await this.requestApproval(req, estimatedCost, policy.requireApproval);
      if (!approved) {
        return {
          allowed: false,
          reason: "APPROVAL_REQUIRED",
          details: "Request requires manual approval"
        };
      }
    }

    // 6. Anomaly detection
    if (policy.anomalyDetection?.enabled) {
      const isAnomaly = await this.detectAnomaly(req, estimatedCost, policy.anomalyDetection);
      if (isAnomaly) {
        await this.sendAlert(policy.anomalyDetection.alertWebhook, req, estimatedCost);
        // Allow but log (not blocking)
      }
    }

    return { allowed: true };
  }

  private isEndpointAllowed(url: string, policy: SpendPolicy): boolean {
    const hostname = new URL(url).hostname;

    // Check blocklist first
    if (policy.blockedEndpoints?.some(pattern => this.matchPattern(hostname, pattern))) {
      return false;
    }

    // Check allowlist
    if (policy.allowedEndpoints.length === 0) {
      return true; // No allowlist = allow all (except blocked)
    }

    return policy.allowedEndpoints.some(pattern => this.matchPattern(hostname, pattern));
  }

  private matchPattern(hostname: string, pattern: string): boolean {
    // Support wildcard patterns: *.example.com
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return regex.test(hostname);
  }

  private async estimateCost(req: ProxyRequest): Promise<string> {
    // Check historical data for endpoint
    const avg = await this.analytics.getAverageCost(req.targetUrl);
    if (avg) return avg;

    // Default estimate (conservative)
    return "1000000"; // 1 USDC
  }
}
```

---

### 2.3 Cache Layer

**Responsibility**: Redis-based response caching and TTL management

#### 2.3.1 Cache Configuration

```typescript
interface CacheConfig {
  enabled: boolean;
  defaultTTLSeconds: number;      // default: 300 (5 min)
  maxCacheSizeBytes: number;      // default: 100MB

  // Pattern-specific TTL rules
  ttlRules?: Array<{
    pattern: string;              // URL pattern
    ttlSeconds: number;
  }>;

  // Exclusion patterns (never cache)
  excludePatterns?: string[];     // ["*/realtime/*", "*/stream/*"]
}
```

#### 2.3.2 Cache Implementation

```typescript
class CacheLayer {
  private redis: Redis;
  private config: CacheConfig;

  async get(key: string): Promise<any | null> {
    if (!this.config.enabled) return null;

    const cached = await this.redis.get(key);
    if (!cached) return null;

    return JSON.parse(cached);
  }

  async set(key: string, value: any, url?: string): Promise<void> {
    if (!this.config.enabled) return;

    // Check size limit
    const serialized = JSON.stringify(value);
    if (serialized.length > this.config.maxCacheSizeBytes) {
      return; // Skip caching if too large
    }

    // Determine TTL
    const ttl = this.getTTL(url);

    await this.redis.setex(key, ttl, serialized);
  }

  async invalidate(pattern: string): Promise<number> {
    // Invalidate all keys matching pattern
    const keys = await this.redis.keys(pattern);
    if (keys.length === 0) return 0;

    return await this.redis.del(...keys);
  }

  private getTTL(url?: string): number {
    if (!url) return this.config.defaultTTLSeconds;

    // Check pattern-specific rules
    for (const rule of this.config.ttlRules || []) {
      if (this.matchPattern(url, rule.pattern)) {
        return rule.ttlSeconds;
      }
    }

    return this.config.defaultTTLSeconds;
  }

  async getCacheStats(projectId: string): Promise<CacheStats> {
    // Aggregate cache hit/miss from analytics
    const stats = await this.analytics.getCacheStats(projectId);

    return {
      hitRate: stats.hits / (stats.hits + stats.misses),
      hitCount: stats.hits,
      missCount: stats.misses,
      totalSavings: stats.cachedRequestsCost,
      avgCacheAge: stats.avgTTL
    };
  }
}
```

---

### 2.4 Analytics Collector

**Responsibility**: Request metric collection, aggregation, and storage

#### 2.4.1 Analytics Schema

```typescript
interface RequestLog {
  id: string;
  projectId: string;
  endpoint: string;
  method: string;
  statusCode: number;
  cost: string;              // USDC amount
  cached: boolean;
  latencyMs: number;
  timestamp: Date;
}

interface EndpointMetrics {
  endpoint: string;
  period: "hourly" | "daily" | "monthly";
  timestamp: Date;

  // Request metrics
  requestCount: number;
  cacheHitCount: number;
  cacheHitRate: number;

  // Latency metrics (milliseconds)
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;

  // Reliability metrics
  successRate: number;        // 2xx / total
  errorCount: number;

  // Cost metrics
  totalSpent: string;         // USDC
  cacheSavings: string;       // USDC saved by cache
}
```

#### 2.4.2 Analytics Pipeline

```typescript
class AnalyticsCollector {
  async logRequest(log: RequestLog): Promise<void> {
    // 1. Store raw log (PostgreSQL)
    await this.db.requests.insert(log);

    // 2. Update real-time counters (Redis)
    await this.updateCounters(log);

    // 3. Emit to SKALE (on-chain metrics)
    await this.emitToBlockchain(log);
  }

  private async updateCounters(log: RequestLog): Promise<void> {
    const key = `metrics:${log.projectId}:${log.endpoint}:hourly`;

    await this.redis
      .multi()
      .hincrby(key, 'requestCount', 1)
      .hincrby(key, 'cacheHitCount', log.cached ? 1 : 0)
      .hincrby(key, 'errorCount', log.statusCode >= 400 ? 1 : 0)
      .hincrbyfloat(key, 'totalSpent', parseFloat(log.cost))
      .expire(key, 7200) // 2 hours TTL
      .exec();
  }

  async aggregateMetrics(period: "hourly" | "daily" | "monthly"): Promise<void> {
    // Background job: aggregate raw logs into metrics table
    const cutoff = this.getPeriodCutoff(period);

    const aggregated = await this.db.query(`
      SELECT
        endpoint,
        COUNT(*) as request_count,
        SUM(CASE WHEN cached THEN 1 ELSE 0 END) as cache_hit_count,
        AVG(latency_ms) as avg_latency_ms,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY latency_ms) as p50_latency_ms,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) as p95_latency_ms,
        PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY latency_ms) as p99_latency_ms,
        SUM(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 ELSE 0 END)::float / COUNT(*) as success_rate,
        SUM(cost::numeric) as total_spent,
        SUM(CASE WHEN cached THEN cost::numeric ELSE 0 END) as cache_savings
      FROM requests
      WHERE timestamp >= $1 AND timestamp < $2
      GROUP BY endpoint
    `, [cutoff.start, cutoff.end]);

    await this.db.endpointMetrics.upsert(aggregated);
  }
}
```

---

### 2.5 Curation Engine

**Responsibility**: Endpoint score calculation, recommendations, and comparisons

#### 2.5.1 Scoring Schema

```typescript
interface EndpointScore {
  endpoint: string;
  category: string;           // "AI", "Data", "Blockchain", etc.

  // Composite score (0-100)
  overallScore: number;

  // Component scores (0-100)
  costScore: number;          // Lower cost = higher score
  latencyScore: number;       // Lower latency = higher score
  reliabilityScore: number;   // Higher success rate = higher score

  // Score weights
  weights: {
    cost: number;             // default: 0.4
    latency: number;          // default: 0.3
    reliability: number;      // default: 0.3
  };

  // Evidence data
  evidence: {
    sampleSize: number;
    period: string;           // "7d", "30d"
    avgCostPerRequest: string;
    avgLatencyMs: number;
    successRate: number;
  };

  updatedAt: Date;
}
```

#### 2.5.2 Scoring Algorithm

```typescript
class CurationEngine {
  async calculateScore(endpoint: string, category: string): Promise<EndpointScore> {
    // Get metrics for last 30 days
    const metrics = await this.analytics.getMetrics(endpoint, "30d");

    if (metrics.requestCount < 10) {
      // Not enough data
      return this.defaultScore(endpoint, category);
    }

    // Get category benchmarks
    const benchmarks = await this.getBenchmarks(category);

    // Calculate component scores
    const costScore = this.scoreCost(
      parseFloat(metrics.totalSpent) / metrics.requestCount,
      benchmarks.avgCost
    );

    const latencyScore = this.scoreLatency(
      metrics.p95LatencyMs,
      benchmarks.avgP95Latency
    );

    const reliabilityScore = this.scoreReliability(
      metrics.successRate,
      benchmarks.avgSuccessRate
    );

    // Get weights (user can customize)
    const weights = this.getWeights(category);

    // Calculate overall score
    const overallScore =
      costScore * weights.cost +
      latencyScore * weights.latency +
      reliabilityScore * weights.reliability;

    return {
      endpoint,
      category,
      overallScore: Math.round(overallScore),
      costScore: Math.round(costScore),
      latencyScore: Math.round(latencyScore),
      reliabilityScore: Math.round(reliabilityScore),
      weights,
      evidence: {
        sampleSize: metrics.requestCount,
        period: "30d",
        avgCostPerRequest: (parseFloat(metrics.totalSpent) / metrics.requestCount).toString(),
        avgLatencyMs: metrics.avgLatencyMs,
        successRate: metrics.successRate
      },
      updatedAt: new Date()
    };
  }

  private scoreCost(avgCost: number, benchmarkCost: number): number {
    // Lower cost = higher score
    // Score = 100 * (1 - (cost / benchmark))
    // Cap at 0-100 range
    const ratio = avgCost / benchmarkCost;
    if (ratio >= 2) return 0;  // 2x benchmark = 0 score
    if (ratio <= 0.5) return 100;  // 0.5x benchmark = 100 score

    return 100 * (1 - (ratio - 0.5) / 1.5);
  }

  private scoreLatency(p95Latency: number, benchmarkLatency: number): number {
    // Lower latency = higher score
    const ratio = p95Latency / benchmarkLatency;
    if (ratio >= 2) return 0;
    if (ratio <= 0.5) return 100;

    return 100 * (1 - (ratio - 0.5) / 1.5);
  }

  private scoreReliability(successRate: number, benchmarkSuccessRate: number): number {
    // Higher success rate = higher score
    // Simple linear mapping: successRate * 100
    return Math.min(100, successRate * 100);
  }

  async recommend(category: string, limit: number = 5): Promise<EndpointScore[]> {
    // Get top N endpoints by overall score in category
    return await this.db.endpointScores
      .where({ category })
      .orderBy('overallScore', 'desc')
      .limit(limit);
  }

  async compare(endpoints: string[]): Promise<ComparisonResult> {
    const scores = await Promise.all(
      endpoints.map(ep => this.getScore(ep))
    );

    return {
      endpoints: scores,
      winner: scores.reduce((best, curr) =>
        curr.overallScore > best.overallScore ? curr : best
      ),
      dimensions: {
        cost: this.rankByDimension(scores, 'costScore'),
        latency: this.rankByDimension(scores, 'latencyScore'),
        reliability: this.rankByDimension(scores, 'reliabilityScore')
      }
    };
  }
}
```

---

## 3. External Service Integrations

### 3.1 x402 SDK Integration

```typescript
// @x402/fetch wrapper
import { X402Client } from '@x402/fetch';

class Pag0Client {
  private x402: X402Client;
  private pag0Proxy: string;

  constructor(config: {
    pag0ProxyUrl: string;
    facilitatorUrl: string;
    apiKey: string;
  }) {
    this.pag0Proxy = config.pag0ProxyUrl;
    this.x402 = new X402Client({
      facilitatorUrl: config.facilitatorUrl
    });
  }

  async fetch(url: string, options?: RequestOptions) {
    // Route through Pag0 proxy
    return await this.x402.fetch(
      `${this.pag0Proxy}/proxy`,
      {
        method: 'POST',
        headers: {
          'X-Pag0-API-Key': this.apiKey
        },
        body: JSON.stringify({
          targetUrl: url,
          method: options?.method || 'GET',
          headers: options?.headers,
          body: options?.body
        })
      }
    );
  }
}
```

### 3.2 CDP Wallet Integration (Coinbase Developer Platform)

**Responsibility**: Providing wallet infrastructure for Agent x402 payment signing

**Method**: Coinbase CDP Server Wallet — Keys managed on Coinbase infrastructure, Pag0 only makes API calls

```typescript
import { CoinbaseSDK } from '@coinbase/sdk';

class CDPWalletManager {
  private sdk: CoinbaseSDK;
  private wallets: Map<string, Wallet> = new Map();

  constructor(config: {
    apiKeyName: string;
    apiKeySecret: string;
    network: 'base' | 'base-sepolia';
  }) {
    this.sdk = new CoinbaseSDK({
      apiKeyName: config.apiKeyName,
      apiKeySecret: config.apiKeySecret,
    });
  }

  /**
   * Create or load a Server Wallet per project
   */
  async getOrCreateWallet(projectId: string): Promise<Wallet> {
    if (this.wallets.has(projectId)) {
      return this.wallets.get(projectId)!;
    }

    // Look up existing wallet or create a new one
    let wallet = await this.sdk.wallets.get(projectId).catch(() => null);
    if (!wallet) {
      wallet = await this.sdk.wallets.create({
        name: `pag0-${projectId}`,
        network: this.network,
      });
    }

    this.wallets.set(projectId, wallet);
    return wallet;
  }

  /**
   * Generate signature for x402 Payment Request
   * - Called when pag0-mcp receives a 402 response
   * - Server Wallet signs the payment payload
   */
  async signPayment(projectId: string, paymentRequest: X402PaymentRequest): Promise<SignedPayment> {
    const wallet = await this.getOrCreateWallet(projectId);
    const address = await wallet.getDefaultAddress();

    // Sign x402 payment payload (keys managed on Coinbase servers)
    const signedPayload = await address.signPayload({
      to: paymentRequest.recipient,
      value: paymentRequest.amount,
      data: paymentRequest.data,
    });

    return {
      payment: paymentRequest,
      signature: signedPayload.signature,
      signer: address.getId(),
    };
  }

  /**
   * Query wallet balance
   */
  async getBalance(projectId: string): Promise<WalletBalance> {
    const wallet = await this.getOrCreateWallet(projectId);
    const balances = await wallet.listBalances();

    return {
      usdc: balances.get('usdc') || '0',
      eth: balances.get('eth') || '0',
      address: (await wallet.getDefaultAddress()).getId(),
    };
  }

  /**
   * Testnet funding (Base Sepolia only)
   */
  async fundTestnet(projectId: string): Promise<FaucetTransaction> {
    const wallet = await this.getOrCreateWallet(projectId);
    return await wallet.faucet(); // Base Sepolia testnet USDC
  }
}

interface WalletBalance {
  usdc: string;
  eth: string;
  address: string;
}
```

**CDP Wallet usage flow in pag0-mcp:**

```
pag0-mcp (MCP Server)
  │
  ├─ pag0_fetch tool call
  │   ├─ 1. Forward request to Pag0 Proxy
  │   ├─ 2. Receive 402 response (PaymentRequest)
  │   ├─ 3. Policy Engine validation (budget, allowlist)
  │   ├─ 4. CDPWalletManager.signPayment() ← CDP Server Wallet signs
  │   ├─ 5. Forward signed payment to Facilitator
  │   └─ 6. Return 200 response + metadata
  │
  ├─ pag0_wallet_balance tool → CDPWalletManager.getBalance()
  └─ pag0_wallet_fund tool    → CDPWalletManager.fundTestnet()
```

**Security Considerations:**

| Item | Design |
|------|--------|
| Key Management | Coinbase Server Wallet — keys managed on Coinbase infrastructure, Pag0 only holds the API Key |
| Signing Authority | Only pag0-mcp can request signatures; no key exposure to AI Agents |
| Spending Limits | Only requests that pass Policy Engine budget validation proceed to signing |
| Audit Trail | All signatures/payments recorded in Analytics Collector + SKALE on-chain logs |

### 3.3 Facilitator Client (x402 Payment Verification)

```typescript
class FacilitatorClient {
  private baseUrl: string;

  async verify(payment: SignedPayment): Promise<VerificationResult> {
    const response = await fetch(`${this.baseUrl}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payment)
    });

    return await response.json();
  }

  async settle(paymentId: string): Promise<SettlementResult> {
    const response = await fetch(`${this.baseUrl}/settle/${paymentId}`, {
      method: 'POST'
    });

    return await response.json();
  }
}
```

### 3.6 SKALE Integration (On-chain ERC-8004 Contracts)

**Network**: SKALE bite-v2-sandbox (Chain ID: `103698795`, Shanghai EVM, zero gas)
**RPC**: `https://base-sepolia-testnet.skalenodes.com/v1/bite-v2-sandbox`

| Contract | Address |
|----------|---------|
| ReputationRegistry | `0xeBEf8A66D614ac91dA4397a5d37A1a2daAD240de` |
| ValidationRegistry | `0x719dBB83664Ad25091CB91b0a39BF52BD7685c0A` |

```solidity
// packages/contracts/src/ReputationRegistry.sol
contract ReputationRegistry {
    event FeedbackGiven(
        string indexed agentId, uint256 value,
        bytes32 tag1, bytes32 tag2,
        string feedbackURI, bytes32 feedbackHash
    );

    function giveFeedback(
        string calldata agentId, uint256 value, uint8 valueDecimals,
        bytes32 tag1, bytes32 tag2,
        string calldata feedbackURI, bytes32 feedbackHash
    ) external {
        emit FeedbackGiven(agentId, value, tag1, tag2, feedbackURI, feedbackHash);
    }
}

// packages/contracts/src/ValidationRegistry.sol
contract ValidationRegistry {
    event ValidationRequested(
        string indexed agentId, bytes data, uint256 timestamp
    );

    function validationRequest(
        string calldata agentId, bytes calldata data
    ) external {
        emit ValidationRequested(agentId, data, block.timestamp);
    }
}
```

```typescript
import { ethers } from 'ethers';

// Deploy: cd packages/contracts && forge script script/Deploy.s.sol --rpc-url skale --broadcast --legacy
// Both contracts are minimal event emitters — no storage, no access control, zero gas on SKALE.
```

### 3.4 ERC-8004 Audit Trail Integration

**Responsibility**: Writing on-chain audit records to the ERC-8004 ReputationRegistry after x402 payment completion

**Method**: Executed asynchronously in the Post-Processing Pipeline — payment success → IPFS metadata upload → giveFeedback() call

```typescript
import { ethers } from 'ethers';
import { create } from 'ipfs-http-client';

class ERC8004AuditTrail {
  private reputationRegistry: ethers.Contract;
  private validationRegistry: ethers.Contract;
  private ipfs: any;

  constructor(config: {
    reputationRegistryAddress: string;
    validationRegistryAddress: string;
    provider: ethers.Provider;
    signer: ethers.Signer;
    ipfsUrl: string;
  }) {
    this.reputationRegistry = new ethers.Contract(
      config.reputationRegistryAddress,
      REPUTATION_REGISTRY_ABI,
      config.signer
    );
    this.validationRegistry = new ethers.Contract(
      config.validationRegistryAddress,
      VALIDATION_REGISTRY_ABI,
      config.signer
    );
    this.ipfs = create({ url: config.ipfsUrl });
  }

  /**
   * Record feedback to ERC-8004 ReputationRegistry after x402 payment completion
   * - Called asynchronously from the Post-Processing Pipeline
   * - feedbackURI includes proofOfPayment (x402 tx hash)
   */
  async recordPaymentFeedback(params: {
    agentId: string;
    endpoint: string;
    cost: string;
    latencyMs: number;
    statusCode: number;
    txHash: string;        // x402 payment transaction hash
    sender: string;        // CDP Wallet address
    receiver: string;      // x402 server address
  }): Promise<string> {
    // 1. Create feedbackURI JSON (upload to IPFS)
    const feedbackData = {
      version: '1.0',
      type: 'x402-payment-audit',
      proofOfPayment: {
        txHash: params.txHash,
        sender: params.sender,
        receiver: params.receiver,
        amount: params.cost,
        network: 'base',
      },
      serviceMetrics: {
        endpoint: params.endpoint,
        latencyMs: params.latencyMs,
        statusCode: params.statusCode,
        timestamp: Date.now(),
      },
    };

    // 2. Upload metadata to IPFS
    const ipfsResult = await this.ipfs.add(JSON.stringify(feedbackData));
    const feedbackURI = `ipfs://${ipfsResult.path}`;

    // 3. Generate feedbackHash (for integrity verification)
    const feedbackHash = ethers.keccak256(
      ethers.toUtf8Bytes(JSON.stringify(feedbackData))
    );

    // 4. Call ReputationRegistry.giveFeedback()
    //    - value: service quality score (based on latency + statusCode)
    //    - tag1: 'x402-payment' (payment type)
    //    - tag2: endpoint category
    const qualityScore = this.calculateQualityScore(
      params.latencyMs, params.statusCode
    );

    const tx = await this.reputationRegistry.giveFeedback(
      params.agentId,           // agentId (x402 server's ERC-8004 ID)
      qualityScore,             // value (service quality 0-100)
      2,                        // valueDecimals
      ethers.encodeBytes32String('x402-payment'),  // tag1
      ethers.encodeBytes32String('api-call'),       // tag2
      feedbackURI,              // IPFS URI (includes proofOfPayment)
      feedbackHash              // integrity hash
    );

    await tx.wait();
    return tx.hash;
  }

  /**
   * Pre-validation request via ValidationRegistry for high-value payments
   * - Called when Policy Engine's requireApproval threshold is exceeded
   */
  async requestValidation(params: {
    agentId: string;
    endpoint: string;
    estimatedCost: string;
    taskDescription: string;
  }): Promise<string> {
    const tx = await this.validationRegistry.validationRequest(
      params.agentId,
      ethers.toUtf8Bytes(JSON.stringify({
        endpoint: params.endpoint,
        estimatedCost: params.estimatedCost,
        task: params.taskDescription,
        timestamp: Date.now(),
      }))
    );

    await tx.wait();
    return tx.hash;
  }

  private calculateQualityScore(latencyMs: number, statusCode: number): number {
    // Success (2xx): latency-based score (0-100)
    if (statusCode >= 200 && statusCode < 300) {
      if (latencyMs < 200) return 100;
      if (latencyMs < 500) return 85;
      if (latencyMs < 1000) return 70;
      if (latencyMs < 3000) return 50;
      return 30;
    }
    // Failure: low score
    return 10;
  }
}
```

**Post-Processing Pipeline Integration:**

```typescript
// Adding ERC-8004 feedback to ProxyCore's Post-Processing
class PostProcessor {
  async process(req: ProxyRequest, response: ProxyResponse, txHash: string) {
    // Existing pipeline (parallel execution)
    await Promise.all([
      this.cacheStore(req, response),
      this.analyticsLog(req, response),
      this.budgetUpdate(req, response),
      // ERC-8004 audit record (async, failure does not affect the response)
      this.erc8004Audit.recordPaymentFeedback({
        agentId: this.resolveAgentId(req.targetUrl),
        endpoint: req.targetUrl,
        cost: response.metadata.cost,
        latencyMs: response.metadata.latency,
        statusCode: response.status,
        txHash: txHash,
        sender: req.walletAddress,
        receiver: this.resolveReceiverAddress(req.targetUrl),
      }).catch(err => console.warn('ERC-8004 feedback failed:', err)),
    ]);
  }
}
```

**ERC-8004 Audit Data Structure:**

| Field | Value | Description |
|-------|-------|-------------|
| `agentId` | x402 server's ERC-8004 ID | Service identifier registered in the Identity Registry |
| `value` | 0-100 | Service quality score based on latency + statusCode |
| `tag1` | `x402-payment` | Feedback type tag |
| `tag2` | `api-call` | Service category tag |
| `feedbackURI` | `ipfs://Qm...` | proofOfPayment + serviceMetrics JSON |
| `feedbackHash` | `0x...` | keccak256 hash of feedbackURI content |

### 3.5 The Graph Integration (Subgraph)

**Goldsky Endpoint**: `https://api.goldsky.com/api/public/project_cmliyvfm2vyq701v0gm02a234/subgraphs/pag0-erc8004/v1/gn`

**Network**: `skale-bite-sandbox` (SKALE bite-v2-sandbox)

```graphql
# subgraph/schema.graphql — ERC-8004 Audit Events

type Agent @entity {
  id: ID!                                                          # keccak256(agentId string)
  feedbacks: [FeedbackEvent!]! @derivedFrom(field: "agent")
  validationRequests: [ValidationRequestEvent!]! @derivedFrom(field: "agent")
  validationResponses: [ValidationResponseEvent!]! @derivedFrom(field: "agent")
  eventCount: Int!
  firstSeen: BigInt!
  lastSeen: BigInt!
}

type FeedbackEvent @entity {
  id: ID!
  agent: Agent!
  agentId: String!
  value: Int!
  tag1: String!
  tag2: String!
  feedbackURI: String!
  feedbackHash: Bytes!
  timestamp: BigInt!
  txHash: String!
}

type ValidationRequestEvent @entity {
  id: ID!
  agent: Agent!
  agentId: String!
  requestData: Bytes!
  timestamp: BigInt!
  txHash: String!
}

type ValidationResponseEvent @entity {
  id: ID!
  agent: Agent!
  agentId: String!
  approved: Boolean!
  responseData: Bytes!
  timestamp: BigInt!
  txHash: String!
}
```

```typescript
// Subgraph query client
const SUBGRAPH_URL = 'https://api.goldsky.com/api/public/project_cmliyvfm2vyq701v0gm02a234/subgraphs/pag0-erc8004/v1/gn';

class GraphClient {
  // Query all feedback events for an agent
  async queryAgentFeedbacks(agentId: string): Promise<FeedbackEvent[]> {
    const query = `
      query AgentFeedbacks($agentId: String!) {
        feedbackEvents(
          where: { agentId: $agentId }
          orderBy: timestamp
          orderDirection: desc
          first: 100
        ) {
          id
          agentId
          value
          tag1
          tag2
          feedbackURI
          feedbackHash
          timestamp
          txHash
        }
      }
    `;

    const response = await fetch(SUBGRAPH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { agentId } })
    });

    return (await response.json()).data.feedbackEvents;
  }

  // Query agent overview with event counts
  async queryAgent(agentIdHash: string): Promise<Agent> {
    const query = `
      query AgentOverview($id: ID!) {
        agent(id: $id) {
          id
          eventCount
          firstSeen
          lastSeen
          feedbacks(first: 10, orderBy: timestamp, orderDirection: desc) {
            value
            tag1
            timestamp
          }
        }
      }
    `;

    const response = await fetch(SUBGRAPH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { id: agentIdHash } })
    });

    return (await response.json()).data.agent;
  }
}
```

---

## 4. Data Storage Design

### 4.1 PostgreSQL Tables (see 05-DB-SCHEMA.md for detailed design)

```sql
-- Core tables
users
projects
policies
requests
endpoint_scores
budgets

-- Aggregate tables
endpoint_metrics_hourly
endpoint_metrics_daily
endpoint_metrics_monthly
```

### 4.2 Redis Keys

```
# Cache
cache:{sha256(url+method+body)} → JSON response (TTL: configurable)

# Budget tracking
budget:{projectId}:daily → spent amount (TTL: midnight UTC)
budget:{projectId}:monthly → spent amount (TTL: end of month)

# Rate limiting
rate:{projectId}:{window} → request count (TTL: 1 minute)

# Score caching
score:{endpoint} → EndpointScore JSON (TTL: 5 minutes)

# Real-time counters
metrics:{projectId}:{endpoint}:hourly → hash (requestCount, cacheHitCount, etc.)
```

---

## 5. Security Considerations

### 5.1 API Key Authentication

```typescript
class AuthMiddleware {
  async authenticate(req: Request): Promise<Project> {
    const apiKey = req.headers.get('X-Pag0-API-Key');

    if (!apiKey) {
      throw new UnauthorizedError('Missing API key');
    }

    // Hash and lookup
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    const user = await this.db.users.findOne({ apiKeyHash: keyHash });

    if (!user) {
      throw new UnauthorizedError('Invalid API key');
    }

    // Rate limiting check
    const allowed = await this.rateLimiter.check(user.id);
    if (!allowed) {
      throw new RateLimitError('Too many requests');
    }

    return user;
  }
}
```

### 5.2 Payment Replay Prevention

```typescript
class ReplayPrevention {
  async checkNonce(payment: SignedPayment): Promise<boolean> {
    const key = `nonce:${payment.id}`;

    // Check if nonce already used
    const exists = await this.redis.get(key);
    if (exists) {
      return false; // Replay attack
    }

    // Store nonce (TTL: 1 hour)
    await this.redis.setex(key, 3600, '1');
    return true;
  }
}
```

### 5.3 Rate Limiting

```typescript
class RateLimiter {
  async check(projectId: string): Promise<boolean> {
    const key = `rate:${projectId}:${Math.floor(Date.now() / 60000)}`;

    const count = await this.redis.incr(key);
    await this.redis.expire(key, 60);

    return count <= this.config.maxRequestsPerMinute;
  }
}
```

### 5.4 HTTPS Only, CORS

```typescript
// Hono middleware
app.use('*', async (c, next) => {
  // HTTPS redirect
  if (c.req.header('x-forwarded-proto') !== 'https') {
    return c.redirect(`https://${c.req.header('host')}${c.req.path}`);
  }

  // CORS
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  c.header('Access-Control-Allow-Headers', 'X-Pag0-API-Key, Content-Type');

  await next();
});
```

---

## 6. Performance Targets

```yaml
# Performance Targets Summary
performance_targets:
  latency:
    cache_hit: "<10ms (P95)"
    cache_miss_proxy: "<200ms (P95)"
    policy_check: "<5ms (P95)"
    analytics_write: "<50ms (Async)"
    api_response_total: "<300ms (P95)"
  throughput:
    requests_per_sec_per_instance: "1,000+"
    concurrent_requests: "10,000+"
    db_connections_pooled: 100
    redis_connections_pooled: 50
  availability:
    uptime: "99.9%"
    error_rate: "<0.1%"
    cache_hit_rate: ">40%"
```

### 6.1 Latency Targets

| Operation | Target | Measurement Basis |
|-----------|--------|-------------------|
| Cache Hit | <10ms | P95 |
| Cache Miss (proxy) | <200ms | P95 |
| Policy Check | <5ms | P95 |
| Analytics Write | <50ms | Async |
| API Response | <300ms | P95 (total) |

### 6.2 Throughput Targets

| Metric | Target |
|--------|--------|
| Requests/sec (per instance) | 1,000+ |
| Concurrent requests | 10,000+ |
| Database connections | 100 (pooled) |
| Redis connections | 50 (pooled) |

### 6.3 Availability Targets

| SLA | Target |
|-----|--------|
| Uptime | 99.9% |
| Error rate | <0.1% |
| Cache hit rate | >40% |

---

## 7. TypeScript Interfaces (Complete)

```typescript
// See 04-API-SPEC.md for complete API interfaces
// Key interfaces repeated here for reference

interface SpendPolicy {
  id: string;
  projectId: string;
  name: string;
  isActive: boolean;
  maxPerRequest: string;
  dailyBudget: string;
  monthlyBudget: string;
  allowedEndpoints: string[];
  blockedEndpoints?: string[];
  requireApproval?: {
    threshold: string;
    webhookUrl: string;
    timeoutSeconds: number;
  };
  anomalyDetection?: {
    enabled: boolean;
    maxDeviationPercent: number;
    alertWebhook: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

interface CacheConfig {
  enabled: boolean;
  defaultTTLSeconds: number;
  maxCacheSizeBytes: number;
  ttlRules?: Array<{ pattern: string; ttlSeconds: number; }>;
  excludePatterns?: string[];
}

interface EndpointMetrics {
  endpoint: string;
  period: "hourly" | "daily" | "monthly";
  requestCount: number;
  cacheHitCount: number;
  cacheHitRate: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  successRate: number;
  errorCount: number;
  totalSpent: string;
  cacheSavings: string;
}

interface EndpointScore {
  endpoint: string;
  category: string;
  overallScore: number;
  costScore: number;
  latencyScore: number;
  reliabilityScore: number;
  weights: { cost: number; latency: number; reliability: number; };
  evidence: {
    sampleSize: number;
    period: string;
    avgCostPerRequest: string;
    avgLatencyMs: number;
    successRate: number;
  };
}
```

---

**Version**: 1.0
**Last Updated**: 2026-02-12
