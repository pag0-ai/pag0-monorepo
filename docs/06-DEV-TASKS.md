# Pag0 Smart Proxy - Development Tasks (3-Day Hackathon)

> **TL;DR**: Detailed development plan to complete Pag0 MVP during a 3-day hackathon. Consists of Day 0 (Pre-setup 2 hours) + Day 1 (Proxy Core + Policy Engine 8 hours) + Day 2 (Curation + Cache + Analytics 9 hours) + Day 3 (Dashboard + Demo + Pitch 8 hours), including step-by-step tasks, code snippets, completion criteria, and risk mitigation strategies.

## Related Documentation

| Document | Relevance |
|------|--------|
| [03-TECH-SPEC.md](03-TECH-SPEC.md) | Architecture and component details |
| [04-API-SPEC.md](04-API-SPEC.md) | API endpoint definitions |
| [05-DB-SCHEMA.md](05-DB-SCHEMA.md) | Database schema |
| [11-DEPLOYMENT-GUIDE.md](11-DEPLOYMENT-GUIDE.md) | Deployment guide |
| [00-GLOSSARY.md](00-GLOSSARY.md) | Glossary |

## Goals

Complete a **working MVP** in 3 days that can be demoed at the hackathon.

**Success Criteria**:

- ✅ All core features working (Proxy, Policy, Curation, Cache, Analytics)
- ✅ 3 demo scenarios ready (Policy enforcement, API curation, Cache savings)
- ✅ Deployed production endpoints
- ✅ Pitch deck complete

```yaml
# Development Timeline Summary
timeline:
  total_days: 3
  total_hours: 27
  breakdown:
    day_0:
      name: "Pre-setup"
      time: "~2 hours"
      core: "Environment setup, external service accounts, x402 SDK testing"
    day_1:
      name: "Proxy Core + Policy Engine"
      time: "8 hours"
      morning: "Proxy Core (x402 integration, proxy endpoint, Payment Relay)"
      afternoon: "Policy Engine (DB schema, CRUD API, Budget Check, Whitelist)"
    day_2:
      name: "Curation + Cache + Analytics"
      time: "9 hours"
      morning: "Curation Engine (Scoring, Recommendation API) + Cache Layer (Redis connection, key generation, TTL management)"
      afternoon: "Analytics (metrics collection, Analytics API)"
      evening: "Integration testing and optimization"
    day_3:
      name: "Dashboard + Demo + Pitch"
      time: "8 hours"
      morning: "Dashboard UI (Next.js, visualization, policy management, rankings)"
      afternoon: "Demo scripts, Pitch Deck, deployment"
```

---

## Day 0: Pre-setup (~2 hours)

### Environment Setup

- [ ] **Install and verify Bun**
  - `curl -fsSL https://bun.sh/install | bash`
  - Verify `bun --version`
  - Time: 10 minutes

- [ ] **Initialize project**
  - `mkdir pag0-proxy && cd pag0-proxy`
  - Run `bun init`
  - Configure `package.json`
  - Time: 15 minutes

- [ ] **Install dependencies**

  ```bash
  bun add hono @hono/node-server
  bun add @x402/fetch  # x402 SDK
  bun add ioredis      # Redis client
  bun add postgres     # PostgreSQL client
  bun add ethers       # SKALE integration
  bun add -d @types/node typescript
  ```

  - Time: 20 minutes

- [ ] **Create external service accounts**
  - [ ] Create Upstash Redis account (<https://upstash.com>)
  - [ ] Create Supabase account (<https://supabase.com>)
  - [ ] Setup SKALE testnet (<https://skale.space>)
  - [ ] Create Fly.io account (<https://fly.io>)
  - Time: 40 minutes

- [ ] **Configure environment variables**

  ```bash
  # .env
  UPSTASH_REDIS_URL=redis://...
  SUPABASE_URL=https://...
  SUPABASE_KEY=...
  SKALE_RPC_URL=https://...
  FACILITATOR_URL=https://facilitator.x402.org
  PORT=3000
  ```

  - Time: 15 minutes

- [ ] **Test x402 SDK**
  - Write simple x402 request test script
  - Verify Facilitator connection
  - Time: 20 minutes

**Day 0 Completion Criteria**:

- ✅ Development environment fully configured
- ✅ All external services accessible
- ✅ x402 SDK verified working

---

## Day 1: Proxy Core + Policy Engine (8 hours)

### Day 1 Morning (4 hours): Proxy Core

#### Task 1.1: Create Project Structure (30 minutes)

- [ ] **Create directory structure**

  ```
  src/
    ├── index.ts           # Entry point
    ├── proxy/
    │   ├── core.ts        # Proxy logic
    │   └── x402.ts        # x402 SDK wrapper
    ├── policy/
    │   └── engine.ts      # Policy evaluation
    ├── cache/
    │   └── redis.ts       # Redis cache layer
    ├── analytics/
    │   └── collector.ts   # Metrics collection
    ├── curation/
    │   └── engine.ts      # Scoring and recommendation
    ├── db/
    │   ├── postgres.ts    # PostgreSQL client
    │   └── schema.sql     # Database schema
    └── types/
        └── index.ts       # TypeScript interfaces
  ```

- [ ] **Basic Hono Server Setup**

  ```typescript
  // src/index.ts
  import { Hono } from 'hono';

  const app = new Hono();

  app.get('/health', (c) => c.json({ status: 'ok' }));

  export default app;
  ```

  - Time: 30 minutes

#### Task 1.2: x402 SDK Integration (1 hour)

- [ ] **Write x402 client wrapper**

  ```typescript
  // src/proxy/x402.ts
  import { X402Client } from '@x402/fetch';

  export class X402Integration {
    private client: X402Client;

    constructor(facilitatorUrl: string) {
      this.client = new X402Client({ facilitatorUrl });
    }

    async forwardRequest(url: string, options: RequestOptions) {
      return await this.client.fetch(url, options);
    }

    parsePaymentRequest(response: Response): PaymentRequest {
      const header = response.headers.get('X-Payment-Request');
      return JSON.parse(header || '{}');
    }
  }
  ```

- [ ] **402 response parsing logic**
  - Extract Payment Request
  - Transform format for relaying to Agent

- [ ] **Test**
  - Request to actual x402 server
  - Verify 402 response parsing
  - Time: 1 hour

#### Task 1.3: Implement Proxy Endpoint (1.5 hours)

- [ ] **Create POST /proxy endpoint**

  ```typescript
  // src/index.ts
  import { proxyHandler } from './proxy/core';

  app.post('/proxy', async (c) => {
    const body = await c.req.json();
    const result = await proxyHandler(body);
    return c.json(result);
  });
  ```

- [ ] **Implement ProxyCore class**

  ```typescript
  // src/proxy/core.ts
  export class ProxyCore {
    async handleRequest(req: ProxyRequest): Promise<ProxyResponse> {
      // 1. Forward to x402 server
      const response = await this.x402.forwardRequest(req.targetUrl, req);

      // 2. Handle 402 Payment Required
      if (response.status === 402) {
        const paymentRequest = this.x402.parsePaymentRequest(response);
        return this.build402Response(paymentRequest);
      }

      // 3. Return success response
      return this.buildResponse(response);
    }
  }
  ```

- [ ] **Error handling**
  - Network errors
  - x402 server timeout
  - Invalid response

- [ ] **Test**
  - Proxy request with Postman/curl
  - Verify 402 response
  - Time: 1.5 hours

#### Task 1.4: Payment Relay Logic (1 hour)

- [ ] **Handle Signed Payment**

  ```typescript
  if (req.signedPayment) {
    // Forward to Facilitator for verification
    const verified = await this.facilitator.verify(req.signedPayment);

    // Forward to x402 server with payment proof
    const finalResponse = await this.x402.forwardWithPayment(
      req.targetUrl,
      req,
      verified.proof
    );

    return this.buildResponse(finalResponse);
  }
  ```

- [ ] **Facilitator client**
  - Call Verify endpoint
  - Call Settle endpoint (optional)

- [ ] **Test**
  - Simulate Mock Agent
  - Verify entire Payment flow
  - Time: 1 hour

**Day 1 Morning Completion Criteria**:

- ✅ Proxy endpoint working
- ✅ x402 request relay successful
- ✅ 402 response parsing and relay
- ✅ Complete Payment flow working

---

### Day 1 Afternoon (4 hours): Policy Engine

#### Task 1.5: Create Database Schema (1 hour)

- [ ] **Create Supabase project**
  - Execute schema in SQL Editor

- [ ] **Create core tables**

  ```sql
  -- See 05-DB-SCHEMA.md
  CREATE TABLE users (...);
  CREATE TABLE projects (...);
  CREATE TABLE policies (...);
  CREATE TABLE budgets (...);
  ```

- [ ] **Setup PostgreSQL client**

  ```typescript
  // src/db/postgres.ts
  import postgres from 'postgres';

  const sql = postgres(process.env.SUPABASE_URL!);
  export default sql;
  ```

- [ ] **Insert initial data**
  - Test user
  - Test project
  - Default policy
  - Time: 1 hour

#### Task 1.6: Policy CRUD API (1 hour)

- [ ] **Define Policy interface**

  ```typescript
  // src/types/index.ts
  export interface SpendPolicy {
    id: string;
    projectId: string;
    name: string;
    isActive: boolean;
    maxPerRequest: string;
    dailyBudget: string;
    monthlyBudget: string;
    allowedEndpoints: string[];
    blockedEndpoints?: string[];
    // ...
  }
  ```

- [ ] **Implement API endpoints**
  - `GET /api/policies` - List policies
  - `POST /api/policies` - Create
  - `GET /api/policies/:id` - Get details
  - `PUT /api/policies/:id` - Update
  - `DELETE /api/policies/:id` - Delete

- [ ] **Database query functions**

  ```typescript
  // src/db/policies.ts
  export async function getActivePolicy(projectId: string) {
    return await sql`
      SELECT * FROM policies
      WHERE project_id = ${projectId} AND is_active = true
      LIMIT 1
    `;
  }
  ```

- [ ] **Test**
  - Verify all CRUD operations
  - Time: 1 hour

#### Task 1.7: Budget Check Logic (1 hour)

- [ ] **Budget Tracker class**

  ```typescript
  // src/policy/budget.ts
  export class BudgetTracker {
    async getDailySpent(projectId: string): Promise<string> {
      // Query PostgreSQL budgets table
      const result = await sql`
        SELECT daily_spent FROM budgets
        WHERE project_id = ${projectId}
      `;
      return result[0]?.daily_spent || '0';
    }

    async deduct(projectId: string, amount: string): Promise<void> {
      await sql`
        UPDATE budgets
        SET daily_spent = daily_spent + ${amount},
            monthly_spent = monthly_spent + ${amount}
        WHERE project_id = ${projectId}
      `;
    }
  }
  ```

- [ ] **Redis fallback (optional)**
  - Redis counter for performance optimization

- [ ] **Test**
  - Verify budget deduction
  - Verify error on exceeded budget
  - Time: 1 hour

#### Task 1.8: Whitelist Matching (1 hour)

- [ ] **PolicyEngine Class**

  ```typescript
  // src/policy/engine.ts
  export class PolicyEngine {
    async evaluate(req: ProxyRequest): Promise<PolicyEvaluation> {
      const policy = await getActivePolicy(req.metadata.projectId);

      // 1. Endpoint whitelist/blacklist
      if (!this.isEndpointAllowed(req.targetUrl, policy)) {
        return { allowed: false, reason: "ENDPOINT_BLOCKED" };
      }

      // 2. Per-request limit
      const cost = await this.estimateCost(req);
      if (BigInt(cost) > BigInt(policy.maxPerRequest)) {
        return { allowed: false, reason: "PER_REQUEST_LIMIT_EXCEEDED" };
      }

      // 3. Daily budget
      const dailySpent = await this.budgetTracker.getDailySpent(req.metadata.projectId);
      if (BigInt(dailySpent) + BigInt(cost) > BigInt(policy.dailyBudget)) {
        return { allowed: false, reason: "DAILY_BUDGET_EXCEEDED" };
      }

      return { allowed: true };
    }

    private isEndpointAllowed(url: string, policy: SpendPolicy): boolean {
      const hostname = new URL(url).hostname;

      // Blocklist check
      if (policy.blockedEndpoints?.some(p => this.matchPattern(hostname, p))) {
        return false;
      }

      // Allowlist check
      if (policy.allowedEndpoints.length === 0) return true;
      return policy.allowedEndpoints.some(p => this.matchPattern(hostname, p));
    }

    private matchPattern(hostname: string, pattern: string): boolean {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      return regex.test(hostname);
    }
  }
  ```

- [ ] **Integrate Policy into ProxyCore**

  ```typescript
  async handleRequest(req: ProxyRequest): Promise<ProxyResponse> {
    // Policy check BEFORE forwarding
    const policyResult = await this.policyEngine.evaluate(req);
    if (!policyResult.allowed) {
      throw new PolicyViolationError(policyResult.reason);
    }

    // ... continue with proxy logic
  }
  ```

- [ ] **Test**
  - Whitelist matching
  - Blocklist blocking
  - Budget exceeded blocking
  - Time: 1 hour

**Day 1 Afternoon Completion Criteria**:

- ✅ Policy CRUD API working
- ✅ Budget tracking working
- ✅ Whitelist/Blacklist filtering working
- ✅ Policy enforcement in Proxy working

---

## Day 2: Curation + Cache + Analytics (9 hours)

### Day 2 Morning (4 hours): Curation Engine + Cache Layer

#### Task 2.1: Redis Connection (30 minutes)

- [ ] **Setup Redis client**

  ```typescript
  // src/cache/redis.ts
  import Redis from 'ioredis';

  const redis = new Redis(process.env.UPSTASH_REDIS_URL!);
  export default redis;
  ```

- [ ] **Test connection**
  - Verify `redis.ping()`
  - Time: 30 minutes

#### Task 2.2: Cache Key Generation (30 minutes)

- [ ] **Cache key generation logic**

  ```typescript
  // src/cache/layer.ts
  export class CacheLayer {
    generateCacheKey(req: ProxyRequest): string {
      const content = req.method === "GET"
        ? `${req.targetUrl}:${req.method}`
        : `${req.targetUrl}:${req.method}:${JSON.stringify(req.body)}`;

      return `cache:${crypto.createHash('sha256').update(content).digest('hex')}`;
    }
  }
  ```

- [ ] **Test**
  - Same request → same key
  - Different request → different key
  - Time: 30 minutes

#### Task 2.3: Cache Store/Retrieve (1 hour)

- [ ] **Cache store**

  ```typescript
  async set(key: string, value: any, ttl: number = 300): Promise<void> {
    const serialized = JSON.stringify(value);

    // Size limit check
    if (serialized.length > this.config.maxCacheSizeBytes) {
      return; // Skip caching
    }

    await redis.setex(key, ttl, serialized);
  }
  ```

- [ ] **Cache retrieve**

  ```typescript
  async get(key: string): Promise<any | null> {
    const cached = await redis.get(key);
    if (!cached) return null;

    return JSON.parse(cached);
  }
  ```

- [ ] **Integrate into ProxyCore**

  ```typescript
  async handleRequest(req: ProxyRequest): Promise<ProxyResponse> {
    // ... policy check

    // Cache check
    const cacheKey = this.cacheLayer.generateCacheKey(req);
    if (!req.cacheBypass) {
      const cached = await this.cacheLayer.get(cacheKey);
      if (cached) {
        return this.buildResponse(cached, { cached: true });
      }
    }

    // ... forward to x402

    // Cache response
    if (this.isCacheable(response)) {
      await this.cacheLayer.set(cacheKey, response);
    }

    // ...
  }
  ```

- [ ] **Test**
  - First request → cache miss
  - Second request → cache hit
  - Time: 1 hour

#### Task 2.4: TTL Management (1 hour)

- [ ] **Pattern-based TTL rules**

  ```typescript
  interface CacheConfig {
    defaultTTLSeconds: number;
    ttlRules?: Array<{
      pattern: string;
      ttlSeconds: number;
    }>;
  }

  private getTTL(url: string): number {
    for (const rule of this.config.ttlRules || []) {
      if (this.matchPattern(url, rule.pattern)) {
        return rule.ttlSeconds;
      }
    }
    return this.config.defaultTTLSeconds;
  }
  ```

- [ ] **Cache invalidation**

  ```typescript
  async invalidate(pattern: string): Promise<number> {
    const keys = await redis.keys(pattern);
    if (keys.length === 0) return 0;
    return await redis.del(...keys);
  }
  ```

- [ ] **API endpoint**
  - `DELETE /api/cache/:pattern` - Invalidate cache

- [ ] **Test**
  - Apply TTL by pattern
  - Test invalidation
  - Time: 1 hour

#### Task 2.5: Cache Bypass (30 minutes)

- [ ] **Handle cacheBypass parameter**
  - `cacheBypass: true` option in `POST /proxy` body

- [ ] **Test**
  - `cacheBypass: true` → always fresh request
  - Time: 30 minutes

**Day 2 Morning Completion Criteria**:

- ✅ Redis caching working
- ✅ Cache hit/miss working properly
- ✅ TTL management working
- ✅ Cache bypass option working

---

### Day 2 Afternoon (3 hours): Analytics

#### Task 2.6: Metrics Collection (1 hour)

- [ ] **Create RequestLog table**

  ```sql
  -- See 05-DB-SCHEMA.md
  CREATE TABLE requests (...);
  ```

- [ ] **Analytics Collector**

  ```typescript
  // src/analytics/collector.ts
  export class AnalyticsCollector {
    async logRequest(log: RequestLog): Promise<void> {
      // 1. Store in PostgreSQL
      await sql`
        INSERT INTO requests (
          project_id, endpoint, full_url, method,
          status_code, cost, cached, latency_ms
        ) VALUES (
          ${log.projectId}, ${log.endpoint}, ${log.fullUrl},
          ${log.method}, ${log.statusCode}, ${log.cost},
          ${log.cached}, ${log.latencyMs}
        )
      `;

      // 2. Update Redis counters (real-time)
      await this.updateCounters(log);
    }

    private async updateCounters(log: RequestLog): Promise<void> {
      const key = `metrics:${log.projectId}:${log.endpoint}:hourly`;

      await redis
        .multi()
        .hincrby(key, 'requestCount', 1)
        .hincrby(key, 'cacheHitCount', log.cached ? 1 : 0)
        .hincrbyfloat(key, 'totalSpent', parseFloat(log.cost))
        .expire(key, 7200)
        .exec();
    }
  }
  ```

- [ ] **Integrate into ProxyCore**

  ```typescript
  // After successful request
  await this.analytics.logRequest({
    projectId: req.metadata.projectId,
    endpoint: new URL(req.targetUrl).hostname,
    fullUrl: req.targetUrl,
    method: req.method,
    statusCode: response.status,
    cost: payment?.amount || '0',
    cached: fromCache,
    latencyMs: Date.now() - startTime
  });
  ```

- [ ] **Test**
  - Verify logs saved to DB after request
  - Verify Redis counter increment
  - Time: 1 hour

#### Task 2.7: Analytics API (1.5 hours)

- [ ] **GET /api/analytics/summary**

  ```typescript
  app.get('/api/analytics/summary', async (c) => {
    const { period = '7d', projectId } = c.req.query();

    const summary = await sql`
      SELECT
        COUNT(*) as total_requests,
        SUM(CASE WHEN cached THEN 1 ELSE 0 END)::float / COUNT(*) as cache_hit_rate,
        AVG(latency_ms) as avg_latency,
        SUM(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 ELSE 0 END)::float / COUNT(*) as success_rate,
        SUM(cost::bigint) as total_cost,
        SUM(CASE WHEN cached THEN cost::bigint ELSE 0 END) as cache_savings
      FROM requests
      WHERE project_id = ${projectId}
        AND created_at >= NOW() - INTERVAL ${period}
    `;

    return c.json(summary[0]);
  });
  ```

- [ ] **GET /api/analytics/endpoints**

  ```typescript
  app.get('/api/analytics/endpoints', async (c) => {
    const { period = '7d', limit = 20 } = c.req.query();

    const endpoints = await sql`
      SELECT
        endpoint,
        COUNT(*) as request_count,
        AVG(latency_ms) as avg_latency_ms,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) as p95_latency_ms,
        SUM(cost::bigint) as total_spent
      FROM requests
      WHERE created_at >= NOW() - INTERVAL ${period}
      GROUP BY endpoint
      ORDER BY request_count DESC
      LIMIT ${limit}
    `;

    return c.json({ endpoints });
  });
  ```

- [ ] **GET /api/analytics/costs**
  - Time series data (daily granularity)

- [ ] **GET /api/analytics/cache**
  - Cache performance analysis

- [ ] **Test**
  - Verify each endpoint response
  - Time: 1.5 hours

#### Task 2.8: Aggregation (30 minutes)

- [ ] **Setup background job (optional)**
  - Hourly/Daily aggregation
  - Update `endpoint_metrics_*` tables

- [ ] **Or real-time aggregation**
  - Aggregate at query time (recommended for MVP)

- [ ] **Test**
  - Verify aggregation results
  - Time: 30 minutes

**Day 2 Afternoon Completion Criteria**:

- ✅ Metrics collection working
- ✅ Logs saved to PostgreSQL
- ✅ Analytics API responding properly

---

### Day 2 Evening (2 hours): Curation Engine

#### Task 2.9: Scoring Algorithm (1 hour)

- [ ] **Create EndpointScore table**

  ```sql
  CREATE TABLE endpoint_scores (...);
  ```

- [ ] **Curation Engine**

  ```typescript
  // src/curation/engine.ts
  export class CurationEngine {
    async calculateScore(endpoint: string, category: string): Promise<EndpointScore> {
      // Get 30-day metrics
      const metrics = await sql`
        SELECT
          COUNT(*) as request_count,
          AVG(cost::bigint) as avg_cost,
          PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) as p95_latency,
          SUM(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 ELSE 0 END)::float / COUNT(*) as success_rate
        FROM requests
        WHERE endpoint = ${endpoint}
          AND created_at >= NOW() - INTERVAL '30 days'
      `;

      if (metrics[0].request_count < 10) {
        return this.defaultScore(endpoint, category);
      }

      // Get category benchmarks
      const benchmarks = await this.getBenchmarks(category);

      // Calculate scores
      const costScore = this.scoreCost(metrics[0].avg_cost, benchmarks.avgCost);
      const latencyScore = this.scoreLatency(metrics[0].p95_latency, benchmarks.avgP95Latency);
      const reliabilityScore = metrics[0].success_rate * 100;

      // Weighted overall score
      const weights = { cost: 0.4, latency: 0.3, reliability: 0.3 };
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
          sampleSize: metrics[0].request_count,
          period: '30d',
          avgCostPerRequest: metrics[0].avg_cost.toString(),
          avgLatencyMs: metrics[0].p95_latency,
          successRate: metrics[0].success_rate
        }
      };
    }

    private scoreCost(cost: number, benchmark: number): number {
      const ratio = cost / benchmark;
      if (ratio >= 2) return 0;
      if (ratio <= 0.5) return 100;
      return 100 * (1 - (ratio - 0.5) / 1.5);
    }
  }
  ```

- [ ] **Test**
  - Verify score calculation logic
  - Time: 1 hour

#### Task 2.10: Recommendation API (1 hour)

- [ ] **GET /api/curation/recommend**

  ```typescript
  app.get('/api/curation/recommend', async (c) => {
    const { category, limit = 5 } = c.req.query();

    const recommendations = await sql`
      SELECT * FROM endpoint_scores
      WHERE category = ${category}
      ORDER BY overall_score DESC
      LIMIT ${limit}
    `;

    return c.json({ category, recommendations });
  });
  ```

- [ ] **GET /api/curation/compare**

  ```typescript
  app.get('/api/curation/compare', async (c) => {
    const { endpoints } = c.req.query(); // "api1.com,api2.com"
    const endpointList = endpoints.split(',');

    const scores = await Promise.all(
      endpointList.map(ep => this.curation.getScore(ep))
    );

    const winner = scores.reduce((best, curr) =>
      curr.overallScore > best.overallScore ? curr : best
    );

    return c.json({ endpoints: scores, winner });
  });
  ```

- [ ] **GET /api/curation/rankings**
  - Full rankings by category

- [ ] **GET /api/curation/categories**
  - List categories

- [ ] **Test**
  - Verify Recommendation response
  - Verify Compare functionality
  - Time: 1 hour

**Day 2 Evening Completion Criteria**:

- ✅ Scoring algorithm working
- ✅ Recommend API responding properly
- ✅ Compare API responding properly

---

## Day 3: Dashboard + Demo + Pitch (8 hours)

### Day 3 Morning (4 hours): Dashboard UI

#### Task 3.1: Create Next.js Project (30 minutes)

- [ ] **Initialize Dashboard project**

  ```bash
  cd ..
  bunx create-next-app pag0-dashboard --typescript --tailwind
  cd pag0-dashboard
  ```

- [ ] **Install dependencies**

  ```bash
  bun add recharts          # Charts
  bun add @tanstack/react-query  # Data fetching
  bun add lucide-react      # Icons
  ```

- [ ] **Setup API client**

  ```typescript
  // lib/api.ts
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

  export async function fetchAnalytics(period: string) {
    const res = await fetch(`${API_BASE}/api/analytics/summary?period=${period}`, {
      headers: { 'X-Pag0-API-Key': localStorage.getItem('apiKey') || '' }
    });
    return res.json();
  }
  ```

- [ ] Time: 30 minutes

#### Task 3.2: Metrics Visualization (1.5 hours)

- [ ] **Dashboard Layout**

  ```typescript
  // app/dashboard/page.tsx
  export default function Dashboard() {
    const { data: analytics } = useQuery(['analytics', '7d'], () => fetchAnalytics('7d'));

    return (
      <div className="grid grid-cols-4 gap-4">
        <MetricCard title="Total Requests" value={analytics?.totalRequests} />
        <MetricCard title="Cache Hit Rate" value={`${(analytics?.cacheHitRate * 100).toFixed(1)}%`} />
        <MetricCard title="Avg Latency" value={`${analytics?.avgLatency}ms`} />
        <MetricCard title="Cache Savings" value={`$${(analytics?.cacheSavings / 1e6).toFixed(2)}`} />
      </div>
    );
  }
  ```

- [ ] **Cost Chart**

  ```typescript
  // components/CostChart.tsx
  import { LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';

  export function CostChart({ data }) {
    return (
      <LineChart width={600} height={300} data={data}>
        <XAxis dataKey="timestamp" />
        <YAxis />
        <Tooltip />
        <Line type="monotone" dataKey="spent" stroke="#8884d8" />
        <Line type="monotone" dataKey="saved" stroke="#82ca9d" />
      </LineChart>
    );
  }
  ```

- [ ] **Endpoint Table**
  - Top endpoints by cost
  - Request count, latency, cache hit rate

- [ ] Time: 1.5 hours

#### Task 3.3: Policy Management UI (1 hour)

- [ ] **Policy List**

  ```typescript
  // app/policies/page.tsx
  export default function Policies() {
    const { data: policies } = useQuery(['policies'], fetchPolicies);

    return (
      <div>
        <h1>Policies</h1>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Daily Budget</th>
              <th>Active</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {policies?.map(p => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>${(p.dailyBudget / 1e6).toFixed(2)}</td>
                <td>{p.isActive ? '✅' : '❌'}</td>
                <td>
                  <button onClick={() => editPolicy(p)}>Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  ```

- [ ] **Policy Form**
  - Create/Edit policy
  - Budget inputs (USDC)
  - Whitelist/Blacklist inputs

- [ ] Time: 1 hour

#### Task 3.4: API Ranking Board (1 hour)

- [ ] **Rankings Page**

  ```typescript
  // app/rankings/page.tsx
  export default function Rankings() {
    const [category, setCategory] = useState('AI');
    const { data: rankings } = useQuery(
      ['rankings', category],
      () => fetchRankings(category)
    );

    return (
      <div>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="AI">AI</option>
          <option value="Data">Data</option>
          <option value="Blockchain">Blockchain</option>
        </select>

        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Endpoint</th>
              <th>Overall Score</th>
              <th>Cost</th>
              <th>Latency</th>
              <th>Reliability</th>
            </tr>
          </thead>
          <tbody>
            {rankings?.map((api, i) => (
              <tr key={api.endpoint}>
                <td>{i + 1}</td>
                <td>{api.endpoint}</td>
                <td>{api.overallScore}</td>
                <td>{api.costScore}</td>
                <td>{api.latencyScore}</td>
                <td>{api.reliabilityScore}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  ```

- [ ] **Score Badges**
  - Color-coded scores (green >80, yellow 60-80, red <60)

- [ ] Time: 1 hour

**Day 3 Morning Completion Criteria**:

- ✅ Dashboard UI working
- ✅ Metrics visualization
- ✅ Policy management UI
- ✅ API Ranking Board display

---

### Day 3 Afternoon (4 hours): Demo + Pitch

#### Task 3.5: Agent Demo Script (1.5 hours)

- [ ] **Write 3 demo scenarios**

**Scenario 1: Policy Enforcement**

```typescript
// demo/scenario1-policy.ts
import { Pag0Client } from '@pag0/sdk';

const pag0 = new Pag0Client({
  apiKey: 'pag0_test_demo',
  baseUrl: 'https://api.pag0.dev'
});

// 1. Set restrictive policy
await pag0.policies.create({
  name: 'Demo Policy',
  maxPerRequest: '100000',  // 0.1 USDC
  dailyBudget: '500000',    // 0.5 USDC
  allowedEndpoints: ['api.demo.com']
});

// 2. Try request within limits
const res1 = await pag0.proxy({
  targetUrl: 'https://api.demo.com/data',
  method: 'GET'
});
console.log('✅ Request allowed:', res1.metadata.cost);

// 3. Try expensive request (should be blocked)
try {
  const res2 = await pag0.proxy({
    targetUrl: 'https://api.expensive.com/data',  // 1 USDC
    method: 'GET'
  });
} catch (err) {
  console.log('❌ Request blocked:', err.message);
  // Expected: "PER_REQUEST_LIMIT_EXCEEDED"
}

// 4. Try blocked endpoint
try {
  const res3 = await pag0.proxy({
    targetUrl: 'https://api.blocked.com/data',
    method: 'GET'
  });
} catch (err) {
  console.log('❌ Endpoint blocked:', err.message);
  // Expected: "ENDPOINT_BLOCKED"
}
```

**Scenario 2: Cache Savings**

```typescript
// demo/scenario2-cache.ts

// 1. First request (cache miss)
console.time('First request');
const res1 = await pag0.proxy({
  targetUrl: 'https://api.demo.com/weather',
  method: 'GET'
});
console.timeEnd('First request');
console.log('Cached:', res1.metadata.cached);  // false
console.log('Cost:', res1.metadata.cost);      // "500000" (0.5 USDC)
console.log('Latency:', res1.metadata.latency); // ~200ms

// 2. Second request (cache hit)
console.time('Second request');
const res2 = await pag0.proxy({
  targetUrl: 'https://api.demo.com/weather',
  method: 'GET'
});
console.timeEnd('Second request');
console.log('Cached:', res2.metadata.cached);  // true
console.log('Cost:', res2.metadata.cost);      // "0" (FREE!)
console.log('Latency:', res2.metadata.latency); // ~8ms

// 3. Show savings
const analytics = await pag0.analytics.summary({ period: '1h' });
console.log('Cache Hit Rate:', `${(analytics.cacheHitRate * 100).toFixed(1)}%`);
console.log('Total Savings:', `$${(analytics.cacheSavings / 1e6).toFixed(2)}`);
```

**Scenario 3: API Curation**

```typescript
// demo/scenario3-curation.ts

// 1. Get AI category recommendations
const recommendations = await pag0.curation.recommend({
  category: 'AI',
  limit: 5
});

console.log('Top 5 AI APIs:');
recommendations.forEach((api, i) => {
  console.log(`${i + 1}. ${api.endpoint}`);
  console.log(`   Overall Score: ${api.overallScore}/100`);
  console.log(`   Avg Cost: $${(parseFloat(api.evidence.avgCostPerRequest) / 1e6).toFixed(3)}`);
  console.log(`   Avg Latency: ${api.evidence.avgLatencyMs}ms`);
  console.log(`   Success Rate: ${(api.evidence.successRate * 100).toFixed(1)}%`);
  console.log('');
});

// 2. Compare two APIs
const comparison = await pag0.curation.compare({
  endpoints: ['api.openai.com', 'api.anthropic.com']
});

console.log('Winner (Overall):', comparison.winner.overall);
console.log('Winner (Cost):', comparison.winner.cost);
console.log('Winner (Latency):', comparison.winner.latency);

// 3. Show rankings
const rankings = await pag0.curation.rankings({ category: 'AI' });
console.log('AI Category Rankings:');
rankings.forEach((api, i) => {
  console.log(`${i + 1}. ${api.endpoint} (${api.overallScore}/100)`);
});
```

- [ ] **Record demo video** (optional)
  - Each scenario execution screen
  - Dashboard UI operations

- [ ] Time: 1.5 hours

#### Task 3.6: Create Pitch Deck (1.5 hours)

- [ ] **Slide structure** (10-12 slides)

**1. Cover Slide**

- Pag0 Logo
- Tagline: "The Smart Proxy Layer for x402 Ecosystem"
- Team name

**2. Problem (3 Pains)**

- No cost control (budget overrun risk)
- Inefficient repeated requests (duplicate payments)
- Lack of API selection information (only subjective reviews exist)

**3. Solution (3-in-1 Value)**

- Cost Reduction: 40%+ savings via caching
- Spend Control: Policy-based budget management
- Curation: Real usage data-based API ranking

**4. Product Demo**

- Screenshot: Dashboard UI
- Screenshot: Policy enforcement in action
- Screenshot: Cache savings metrics

**5. Market Opportunity**

- x402 ecosystem growth (Coinbase backing)
- AI Agent market expansion
- TAM/SAM/SOM estimation

**6. Unique Positioning**

- Layer map (Pag0 is the only Proxy layer)
- vs SlinkyLayer (subjective vs objective data)
- vs x402 SDK (protocol vs control)

**7. Technology Stack**

- Bun + Hono (Edge-optimized)
- Redis (Upstash) - Serverless caching
- PostgreSQL (Supabase) - Scalable storage
- SKALE - Zero gas on-chain metrics
- The Graph - Payment event indexing

**8. Business Model**

- Freemium: 1K req/day free
- Cache Savings Share: 15% of savings
- Pro: $99/month unlimited

**9. Traction (Post-Hackathon Plan)**

- Week 1: Launch MVP
- Month 1-3: 100 MAU
- Month 4-12: 1,000 MAU, Pro tier

**10. Team**

- Team members (names, roles, backgrounds)

**11. Ask**

- Looking for: Partnerships with Coinbase, SKALE
- Next milestones: Launch, user acquisition

**12. Thank You**

- Contact info
- Live demo link

- [ ] **Design tools**
  - Canva / Figma / Google Slides
  - Pag0 branding (color scheme, logo)

- [ ] Time: 1.5 hours

#### Task 3.7: Deployment (1 hour)

- [ ] **Deploy to Fly.io (Backend)**

  ```bash
  cd pag0-proxy
  fly launch
  fly deploy
  fly secrets set UPSTASH_REDIS_URL=... SUPABASE_URL=...
  ```

- [ ] **Deploy to Vercel (Dashboard)**

  ```bash
  cd pag0-dashboard
  vercel --prod
  ```

- [ ] **DNS setup** (optional)
  - api.pag0.dev → Fly.io
  - app.pag0.dev → Vercel

- [ ] **Health check**
  - `curl https://api.pag0.dev/health`
  - Verify Dashboard access

- [ ] Time: 1 hour

**Day 3 Afternoon Completion Criteria**:

- ✅ 3 demo scenario scripts
- ✅ Pitch Deck complete
- ✅ Production deployment complete
- ✅ Live demo ready

---

## Risk Mitigation Strategy

```yaml
# Risk Matrix
risks:
  day_1:
    - risk: "x402 SDK integration failure"
      severity: "high"
      mitigation: "Test in advance on Day 0"
      fallback: "Use Mock x402 server (402 response simulation)"
    - risk: "Policy Engine complexity"
      severity: "medium"
      mitigation: "MVP has basic features only (whitelist, budget)"
      defer: "Approval workflow, Anomaly detection (Post-hackathon)"
  day_2:
    - risk: "Redis caching issues"
      severity: "medium"
      mitigation: "Local Redis (Docker) instead of Upstash"
      fallback: "In-memory cache (Map)"
    - risk: "Analytics aggregation performance"
      severity: "low"
      mitigation: "Hourly aggregation later, use real-time queries only"
      defer: "Background jobs (Post-hackathon)"
    - risk: "Curation data shortage"
      severity: "medium"
      mitigation: "Generate seed data (synthetic metrics)"
      fallback: "Mock scores"
  day_3:
    - risk: "Dashboard UI development time shortage"
      severity: "medium"
      mitigation: "Use basic tables only (Tailwind CSS)"
      defer: "Advanced charts, animations (Post-hackathon)"
    - risk: "Deployment failure"
      severity: "high"
      mitigation: "Test deployment in Day 2 evening"
      fallback: "localhost demo (recorded video)"
    - risk: "Demo scenario not working"
      severity: "high"
      mitigation: "Pre-rehearsal (Day 3 morning)"
      fallback: "Recorded demo video"
```

### Day 1 Risks

**Risk**: x402 SDK integration failure

- **Response**: Test in advance on Day 0
- **Alternative**: Use Mock x402 server (402 response simulation)

**Risk**: Policy Engine complexity

- **Response**: MVP has basic features only (whitelist, budget)
- **Deferred**: Approval workflow, Anomaly detection (Post-hackathon)

### Day 2 Risks

**Risk**: Redis caching issues

- **Response**: Local Redis (Docker) instead of Upstash
- **Alternative**: In-memory cache (Map)

**Risk**: Analytics aggregation performance

- **Response**: Hourly aggregation later, use real-time queries only
- **Deferred**: Background jobs (Post-hackathon)

**Risk**: Curation data shortage

- **Response**: Generate seed data (synthetic metrics)
- **Alternative**: Mock scores

### Day 3 Risks

**Risk**: Dashboard UI development time shortage

- **Response**: Use basic tables only (Tailwind CSS)
- **Deferred**: Advanced charts, animations (Post-hackathon)

**Risk**: Deployment failure

- **Response**: Test deployment in Day 2 evening
- **Alternative**: localhost demo (recorded video)

**Risk**: Demo scenario not working

- **Response**: Pre-rehearsal (Day 3 morning)
- **Alternative**: Recorded demo video

---

## Daily Checklist

### End of Day 1

- [ ] Proxy endpoint working (Postman test)
- [ ] 402 response relay verified
- [ ] Policy enforcement working (budget, whitelist)
- [ ] Policies saved to PostgreSQL
- [ ] Git commit + push

### End of Day 2

- [ ] Cache hit/miss working
- [ ] Cache saved to Redis
- [ ] Analytics API responding properly
- [ ] Curation API recommendation working
- [ ] Git commit + push
- [ ] Deployment test (optional)

### End of Day 3

- [ ] Dashboard UI working
- [ ] 3 demo scenario scripts
- [ ] Pitch Deck complete
- [ ] Production deployment successful
- [ ] Live demo ready
- [ ] Git commit + push

---

## Final Deliverables

### Code

- [ ] Backend (Bun + Hono) - GitHub repo
- [ ] Dashboard (Next.js) - GitHub repo
- [ ] Demo scripts - `/demo` folder

### Documentation

- [ ] README.md (Getting Started)
- [ ] API documentation (04-API-SPEC.md)
- [ ] Deployment guide

### Demo

- [ ] Live demo URL (api.pag0.dev)
- [ ] Dashboard URL (app.pag0.dev)
- [ ] Demo video (optional)

### Presentation

- [ ] Pitch Deck (PDF + Google Slides)
- [ ] 3-minute pitch script
- [ ] Q&A preparation (FAQ)

---

**Good luck! 🚀**

**Version**: 1.0
**Last Updated**: 2026-02-10
