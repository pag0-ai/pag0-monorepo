# Pag0 Smart Proxy - 기술 명세서

> **TL;DR**: Hono + Bun 런타임 기반의 Edge-first 아키텍처로, Proxy Core / Policy Engine / Curation Engine / Cache Layer / Analytics Collector 5개 핵심 컴포넌트로 구성됩니다. Redis(Upstash) 캐싱으로 40%+ 비용 절감, PostgreSQL(Supabase) 분석 저장, SKALE 온체인 메트릭을 지원하며, P95 API 응답 목표는 300ms 이내입니다.

## 관련 문서

| 문서 | 관련성 |
|------|--------|
| [04-API-SPEC.md](04-API-SPEC.md) | API 엔드포인트 정의 |
| [05-DB-SCHEMA.md](05-DB-SCHEMA.md) | 데이터베이스 스키마 상세 |
| [06-DEV-TASKS.md](06-DEV-TASKS.md) | 개발 태스크 및 구현 순서 |
| [10-SECURITY-DESIGN.md](10-SECURITY-DESIGN.md) | 보안 설계 상세 |
| [00-GLOSSARY.md](00-GLOSSARY.md) | 용어집 |

## 1. 시스템 아키텍처

### 1.1 고수준 아키텍처

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
│  ┌────────────────┐  ┌─────────────────┐  ┌──────────────────┐    │
│  │ Cache Store    │  │ Analytics       │  │ Budget Update    │    │
│  │ (if cacheable) │  │ Logger          │  │                  │    │
│  └────────────────┘  └─────────────────┘  └──────────────────┘    │
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
│  │ (Supabase)       │  │ (Upstash)        │  │                  │  │
│  │                  │  │                  │  │                  │  │
│  │ - Policies       │  │ - Cache          │  │ - On-chain       │  │
│  │ - Requests Log   │  │ - Budget Counter │  │   Metrics        │  │
│  │ - Analytics      │  │ - Rate Limits    │  │ - Immutable      │  │
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

### 1.2 배포 아키텍처

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

## 2. 컴포넌트 상세

### 2.1 Proxy Core

**책임**: x402 요청 중계 및 결제 프로세스 오케스트레이션

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

**책임**: 예산 한도, whitelist/blacklist, 승인 워크플로우 검증

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

**책임**: Redis 기반 응답 캐싱, TTL 관리

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

**책임**: 요청 메트릭 수집, 집계, 저장

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

**책임**: 엔드포인트 점수 계산, 추천, 비교

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

## 3. 외부 서비스 연동

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

### 3.2 Facilitator Client

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

### 3.3 SKALE Integration (On-chain Metrics)

```typescript
import { ethers } from 'ethers';

class SKALEMetrics {
  private contract: ethers.Contract;

  async emitMetric(metric: {
    endpoint: string;
    cost: string;
    latency: number;
    timestamp: number;
  }): Promise<void> {
    // Emit to SKALE (zero gas)
    const tx = await this.contract.logMetric(
      metric.endpoint,
      metric.cost,
      metric.latency,
      metric.timestamp
    );

    await tx.wait();
  }

  async getOnChainMetrics(endpoint: string): Promise<any[]> {
    // Query historical metrics from SKALE
    return await this.contract.getMetrics(endpoint);
  }
}

// Smart Contract (Solidity)
// contract Pag0Metrics {
//   event MetricLogged(
//     string indexed endpoint,
//     uint256 cost,
//     uint256 latency,
//     uint256 timestamp
//   );
//
//   function logMetric(
//     string memory endpoint,
//     uint256 cost,
//     uint256 latency,
//     uint256 timestamp
//   ) public {
//     emit MetricLogged(endpoint, cost, latency, timestamp);
//   }
// }
```

### 3.4 The Graph Integration (Subgraph)

```graphql
# schema.graphql
type PaymentEvent @entity {
  id: ID!
  endpoint: String!
  amount: BigInt!
  timestamp: BigInt!
  txHash: String!
  agent: String!
  project: String!
}

type EndpointAggregate @entity {
  id: ID!  # endpoint
  totalPayments: BigInt!
  totalAmount: BigInt!
  avgAmount: BigInt!
  lastPaymentTimestamp: BigInt!
}
```

```typescript
// Subgraph query client
class GraphClient {
  async queryPaymentHistory(endpoint: string): Promise<PaymentEvent[]> {
    const query = `
      query PaymentHistory($endpoint: String!) {
        paymentEvents(
          where: { endpoint: $endpoint }
          orderBy: timestamp
          orderDirection: desc
          first: 100
        ) {
          id
          amount
          timestamp
          txHash
          agent
        }
      }
    `;

    const response = await fetch(this.graphUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { endpoint } })
    });

    return (await response.json()).data.paymentEvents;
  }
}
```

---

## 4. 데이터 저장소 설계

### 4.1 PostgreSQL Tables (상세 설계는 05-DB-SCHEMA.md 참조)

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

## 5. 보안 고려사항

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

## 6. 성능 목표

```yaml
# 성능 목표 요약
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

### 6.1 지연 시간 목표

| 작업 | 목표 | 측정 기준 |
|------|------|-----------|
| Cache Hit | <10ms | P95 |
| Cache Miss (proxy) | <200ms | P95 |
| Policy Check | <5ms | P95 |
| Analytics Write | <50ms | Async |
| API Response | <300ms | P95 (total) |

### 6.2 처리량 목표

| 지표 | 목표 |
|------|------|
| Requests/sec (인스턴스당) | 1,000+ |
| 동시 요청 수 | 10,000+ |
| Database 커넥션 | 100 (pooled) |
| Redis 커넥션 | 50 (pooled) |

### 6.3 가용성 목표

| SLA | 목표 |
|-----|------|
| Uptime | 99.9% |
| Error rate | <0.1% |
| Cache hit rate | >40% |

---

## 7. TypeScript 인터페이스 (전체)

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
**Last Updated**: 2026-02-10
