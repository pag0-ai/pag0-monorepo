# Pag0 Smart Proxy - 개발 태스크 (3일 해커톤)

> **TL;DR**: 3일 해커톤 기간 동안 Pag0 MVP를 완성하는 상세 개발 계획입니다. Day 0(사전 준비 2시간) + Day 1(Proxy Core + Policy Engine 8시간) + Day 2(Curation + Cache + Analytics 9시간) + Day 3(Dashboard + Demo + Pitch 8시간)으로 구성되며, 각 단계별 태스크, 코드 스니펫, 완료 기준, 리스크 대응 방안을 포함합니다.

## 관련 문서

| 문서 | 관련성 |
|------|--------|
| [03-TECH-SPEC.md](03-TECH-SPEC.md) | 아키텍처 및 컴포넌트 상세 |
| [04-API-SPEC.md](04-API-SPEC.md) | API 엔드포인트 정의 |
| [05-DB-SCHEMA.md](05-DB-SCHEMA.md) | 데이터베이스 스키마 |
| [11-DEPLOYMENT-GUIDE.md](11-DEPLOYMENT-GUIDE.md) | 배포 가이드 |
| [00-GLOSSARY.md](00-GLOSSARY.md) | 용어집 |

## 목표

3일 동안 **working MVP**를 완성하여 해커톤에서 시연 가능한 상태로 만듭니다.

**성공 기준**:

- ✅ 모든 핵심 기능 동작 (Proxy, Policy, Curation, Cache, Analytics)
- ✅ 3개 시나리오 데모 가능 (Policy enforcement, API curation, Cache savings)
- ✅ 배포된 프로덕션 엔드포인트
- ✅ Pitch deck 완성

```yaml
# 개발 타임라인 요약
timeline:
  total_days: 3
  total_hours: 27
  breakdown:
    day_0:
      이름: "사전 준비"
      시간: "~2시간"
      핵심: "환경 설정, 외부 서비스 계정, x402 SDK 테스트"
    day_1:
      이름: "Proxy Core + Policy Engine"
      시간: "8시간"
      오전: "Proxy Core (x402 통합, 프록시 엔드포인트, Payment Relay)"
      오후: "Policy Engine (DB 스키마, CRUD API, Budget Check, Whitelist)"
    day_2:
      이름: "Curation + Cache + Analytics"
      시간: "9시간"
      오전: "Curation Engine (Scoring, Recommendation API) + Cache Layer (Redis 연결, 키 생성, TTL 관리)"
      오후: "Analytics (메트릭 수집, Analytics API)"
      저녁: "통합 테스트 및 최적화"
    day_3:
      이름: "Dashboard + Demo + Pitch"
      시간: "8시간"
      오전: "Dashboard UI (Next.js, 시각화, 정책 관리, 랭킹)"
      오후: "Demo 스크립트, Pitch Deck, 배포"
```

---

## Day 0: 사전 준비 (~2시간)

### 환경 설정

- [ ] **Bun 설치 및 검증**
  - `curl -fsSL https://bun.sh/install | bash`
  - `bun --version` 확인
  - 시간: 10분

- [ ] **프로젝트 초기화**
  - `mkdir pag0-proxy && cd pag0-proxy`
  - `bun init` 실행
  - `package.json` 설정
  - 시간: 15분

- [ ] **Dependencies 설치**

  ```bash
  bun add hono @hono/node-server
  bun add @x402/fetch  # x402 SDK
  bun add ioredis      # Redis client
  bun add postgres     # PostgreSQL client
  bun add ethers       # SKALE integration
  bun add -d @types/node typescript
  ```

  - 시간: 20분

- [ ] **외부 서비스 계정 생성**
  - [ ] Upstash Redis 계정 생성 (<https://upstash.com>)
  - [ ] Supabase 계정 생성 (<https://supabase.com>)
  - [ ] SKALE testnet 설정 (<https://skale.space>)
  - [ ] Fly.io 계정 생성 (<https://fly.io>)
  - 시간: 40분

- [ ] **환경 변수 설정**

  ```bash
  # .env
  UPSTASH_REDIS_URL=redis://...
  SUPABASE_URL=https://...
  SUPABASE_KEY=...
  SKALE_RPC_URL=https://...
  FACILITATOR_URL=https://facilitator.x402.org
  PORT=3000
  ```

  - 시간: 15분

- [ ] **x402 SDK 테스트**
  - 간단한 x402 요청 테스트 스크립트 작성
  - Facilitator 연결 확인
  - 시간: 20분

**Day 0 완료 기준**:

- ✅ 개발 환경 완전히 설정됨
- ✅ 모든 외부 서비스 접근 가능
- ✅ x402 SDK 동작 확인

---

## Day 1: Proxy Core + Policy Engine (8시간)

### Day 1 Morning (4시간): Proxy Core

#### Task 1.1: 프로젝트 구조 생성 (30분)

- [ ] **디렉토리 구조 생성**

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

- [ ] **기본 Hono 서버 설정**

  ```typescript
  // src/index.ts
  import { Hono } from 'hono';

  const app = new Hono();

  app.get('/health', (c) => c.json({ status: 'ok' }));

  export default app;
  ```

  - 시간: 30분

#### Task 1.2: x402 SDK Integration (1시간)

- [ ] **x402 클라이언트 래퍼 작성**

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

- [ ] **402 응답 파싱 로직**
  - Payment Request 추출
  - Agent에게 relay할 형식 변환

- [ ] **테스트**
  - 실제 x402 서버에 요청
  - 402 응답 파싱 확인
  - 시간: 1시간

#### Task 1.3: Proxy Endpoint 구현 (1.5시간)

- [ ] **POST /proxy 엔드포인트 생성**

  ```typescript
  // src/index.ts
  import { proxyHandler } from './proxy/core';

  app.post('/proxy', async (c) => {
    const body = await c.req.json();
    const result = await proxyHandler(body);
    return c.json(result);
  });
  ```

- [ ] **ProxyCore 클래스 구현**

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

- [ ] **에러 처리**
  - Network errors
  - x402 server timeout
  - Invalid response

- [ ] **테스트**
  - Postman/curl로 프록시 요청
  - 402 응답 확인
  - 시간: 1.5시간

#### Task 1.4: Payment Relay 로직 (1시간)

- [ ] **Signed Payment 처리**

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

- [ ] **Facilitator 클라이언트**
  - Verify endpoint 호출
  - Settle endpoint 호출 (optional)

- [ ] **테스트**
  - Mock Agent 시뮬레이션
  - Payment flow 전체 검증
  - 시간: 1시간

**Day 1 Morning 완료 기준**:

- ✅ Proxy endpoint 동작
- ✅ x402 요청 중계 성공
- ✅ 402 응답 파싱 및 relay
- ✅ Payment flow 전체 동작

---

### Day 1 Afternoon (4시간): Policy Engine

#### Task 1.5: Database Schema 생성 (1시간)

- [ ] **Supabase 프로젝트 생성**
  - SQL Editor에서 스키마 실행

- [ ] **핵심 테이블 생성**

  ```sql
  -- 05-DB-SCHEMA.md 참조
  CREATE TABLE users (...);
  CREATE TABLE projects (...);
  CREATE TABLE policies (...);
  CREATE TABLE budgets (...);
  ```

- [ ] **PostgreSQL 클라이언트 설정**

  ```typescript
  // src/db/postgres.ts
  import postgres from 'postgres';

  const sql = postgres(process.env.SUPABASE_URL!);
  export default sql;
  ```

- [ ] **초기 데이터 삽입**
  - 테스트 사용자
  - 테스트 프로젝트
  - 기본 정책
  - 시간: 1시간

#### Task 1.6: Policy CRUD API (1시간)

- [ ] **Policy 인터페이스 정의**

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

- [ ] **API 엔드포인트 구현**
  - `GET /api/policies` - 목록 조회
  - `POST /api/policies` - 생성
  - `GET /api/policies/:id` - 상세 조회
  - `PUT /api/policies/:id` - 수정
  - `DELETE /api/policies/:id` - 삭제

- [ ] **Database 쿼리 함수**

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

- [ ] **테스트**
  - CRUD 모든 동작 확인
  - 시간: 1시간

#### Task 1.7: Budget Check 로직 (1시간)

- [ ] **Budget Tracker 클래스**

  ```typescript
  // src/policy/budget.ts
  export class BudgetTracker {
    async getDailySpent(projectId: string): Promise<string> {
      // PostgreSQL budgets 테이블 조회
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
  - 성능 최적화를 위한 Redis 카운터

- [ ] **테스트**
  - 예산 차감 동작 확인
  - 초과 시 에러 확인
  - 시간: 1시간

#### Task 1.8: Whitelist Matching (1시간)

- [ ] **PolicyEngine 클래스**

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

- [ ] **ProxyCore에 Policy 통합**

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

- [ ] **테스트**
  - Whitelist 매칭
  - Blocklist 차단
  - 예산 초과 차단
  - 시간: 1시간

**Day 1 Afternoon 완료 기준**:

- ✅ Policy CRUD API 동작
- ✅ Budget tracking 동작
- ✅ Whitelist/Blacklist 필터링 동작
- ✅ Proxy에서 Policy enforcement 동작

---

## Day 2: Curation + Cache + Analytics (9시간)

### Day 2 Morning (4시간): Curation Engine + Cache Layer

#### Task 2.1: Redis 연결 (30분)

- [ ] **Redis 클라이언트 설정**

  ```typescript
  // src/cache/redis.ts
  import Redis from 'ioredis';

  const redis = new Redis(process.env.UPSTASH_REDIS_URL!);
  export default redis;
  ```

- [ ] **연결 테스트**
  - `redis.ping()` 확인
  - 시간: 30분

#### Task 2.2: Cache Key 생성 (30분)

- [ ] **캐시 키 생성 로직**

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

- [ ] **테스트**
  - 동일 요청 → 동일 키
  - 다른 요청 → 다른 키
  - 시간: 30분

#### Task 2.3: Cache Store/Retrieve (1시간)

- [ ] **Cache 저장**

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

- [ ] **Cache 조회**

  ```typescript
  async get(key: string): Promise<any | null> {
    const cached = await redis.get(key);
    if (!cached) return null;

    return JSON.parse(cached);
  }
  ```

- [ ] **ProxyCore에 통합**

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

- [ ] **테스트**
  - 첫 요청 → cache miss
  - 두 번째 요청 → cache hit
  - 시간: 1시간

#### Task 2.4: TTL Management (1시간)

- [ ] **Pattern-based TTL 규칙**

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

- [ ] **Cache 무효화**

  ```typescript
  async invalidate(pattern: string): Promise<number> {
    const keys = await redis.keys(pattern);
    if (keys.length === 0) return 0;
    return await redis.del(...keys);
  }
  ```

- [ ] **API 엔드포인트**
  - `DELETE /api/cache/:pattern` - 캐시 무효화

- [ ] **테스트**
  - 패턴별 TTL 적용
  - 무효화 동작
  - 시간: 1시간

#### Task 2.5: Cache Bypass (30분)

- [ ] **cacheBypass 파라미터 처리**
  - `POST /proxy` body에 `cacheBypass: true` 옵션

- [ ] **테스트**
  - `cacheBypass: true` → 항상 fresh request
  - 시간: 30분

**Day 2 Morning 완료 기준**:

- ✅ Redis 캐싱 동작
- ✅ Cache hit/miss 정상 작동
- ✅ TTL 관리 동작
- ✅ Cache bypass 옵션 동작

---

### Day 2 Afternoon (3시간): Analytics

#### Task 2.6: Metrics Collection (1시간)

- [ ] **RequestLog 테이블 생성**

  ```sql
  -- 05-DB-SCHEMA.md 참조
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

- [ ] **ProxyCore에 통합**

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

- [ ] **테스트**
  - 요청 후 DB에 로그 저장 확인
  - Redis 카운터 증가 확인
  - 시간: 1시간

#### Task 2.7: Analytics API (1.5시간)

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
  - 시계열 데이터 (daily granularity)

- [ ] **GET /api/analytics/cache**
  - 캐시 성능 분석

- [ ] **테스트**
  - 각 엔드포인트 응답 확인
  - 시간: 1.5시간

#### Task 2.8: Aggregation (30분)

- [ ] **Background job 설정 (optional)**
  - Hourly/Daily aggregation
  - `endpoint_metrics_*` 테이블 업데이트

- [ ] **또는 실시간 집계**
  - 쿼리 시점에 집계 (MVP는 이 방식 권장)

- [ ] **테스트**
  - Aggregation 결과 확인
  - 시간: 30분

**Day 2 Afternoon 완료 기준**:

- ✅ Metrics 수집 동작
- ✅ PostgreSQL에 로그 저장
- ✅ Analytics API 응답 정상

---

### Day 2 Evening (2시간): Curation Engine

#### Task 2.9: Scoring Algorithm (1시간)

- [ ] **EndpointScore 테이블 생성**

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

- [ ] **테스트**
  - 점수 계산 로직 확인
  - 시간: 1시간

#### Task 2.10: Recommendation API (1시간)

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
  - 카테고리별 전체 랭킹

- [ ] **GET /api/curation/categories**
  - 카테고리 목록

- [ ] **테스트**
  - Recommendation 응답 확인
  - Compare 동작 확인
  - 시간: 1시간

**Day 2 Evening 완료 기준**:

- ✅ Scoring algorithm 동작
- ✅ Recommend API 응답 정상
- ✅ Compare API 응답 정상

---

## Day 3: Dashboard + Demo + Pitch (8시간)

### Day 3 Morning (4시간): Dashboard UI

#### Task 3.1: Next.js 프로젝트 생성 (30분)

- [ ] **Dashboard 프로젝트 초기화**

  ```bash
  cd ..
  bunx create-next-app pag0-dashboard --typescript --tailwind
  cd pag0-dashboard
  ```

- [ ] **Dependencies 설치**

  ```bash
  bun add recharts          # Charts
  bun add @tanstack/react-query  # Data fetching
  bun add lucide-react      # Icons
  ```

- [ ] **API 클라이언트 설정**

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

- [ ] 시간: 30분

#### Task 3.2: Metrics Visualization (1.5시간)

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

- [ ] 시간: 1.5시간

#### Task 3.3: Policy Management UI (1시간)

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

- [ ] 시간: 1시간

#### Task 3.4: API Ranking Board (1시간)

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

- [ ] 시간: 1시간

**Day 3 Morning 완료 기준**:

- ✅ Dashboard UI 동작
- ✅ Metrics 시각화
- ✅ Policy 관리 UI
- ✅ API Ranking Board 표시

---

### Day 3 Afternoon (4시간): Demo + Pitch

#### Task 3.5: Agent Demo Script (1.5시간)

- [ ] **Demo 시나리오 3가지 작성**

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

- [ ] **Demo 비디오 녹화** (optional)
  - 각 시나리오 실행 화면
  - Dashboard UI 조작

- [ ] 시간: 1.5시간

#### Task 3.6: Pitch Deck 작성 (1.5시간)

- [ ] **슬라이드 구성** (10-12 슬라이드)

**1. Cover Slide**

- Pag0 로고
- Tagline: "The Smart Proxy Layer for x402 Ecosystem"
- Team name

**2. Problem (3 Pains)**

- 비용 제어 부재 (예산 초과 위험)
- 반복 요청 비효율 (중복 결제)
- API 선택 정보 부족 (주관적 리뷰만 존재)

**3. Solution (3-in-1 Value)**

- Cost Reduction: 40%+ savings via caching
- Spend Control: Policy-based budget management
- Curation: Real usage data-based API ranking

**4. Product Demo**

- Screenshot: Dashboard UI
- Screenshot: Policy enforcement in action
- Screenshot: Cache savings metrics

**5. Market Opportunity**

- x402 생태계 성장 (Coinbase backing)
- AI Agent 시장 확대
- TAM/SAM/SOM 추정

**6. Unique Positioning**

- Layer map (Pag0의 유일한 Proxy layer)
- vs SlinkyLayer (주관 vs 객관 데이터)
- vs x402 SDK (프로토콜 vs 제어)

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

- [ ] **디자인 도구**
  - Canva / Figma / Google Slides
  - Pag0 브랜딩 (color scheme, logo)

- [ ] 시간: 1.5시간

#### Task 3.7: 배포 (1시간)

- [ ] **Fly.io 배포 (Backend)**

  ```bash
  cd pag0-proxy
  fly launch
  fly deploy
  fly secrets set UPSTASH_REDIS_URL=... SUPABASE_URL=...
  ```

- [ ] **Vercel 배포 (Dashboard)**

  ```bash
  cd pag0-dashboard
  vercel --prod
  ```

- [ ] **DNS 설정** (optional)
  - api.pag0.dev → Fly.io
  - app.pag0.dev → Vercel

- [ ] **Health check**
  - `curl https://api.pag0.dev/health`
  - Dashboard 접속 확인

- [ ] 시간: 1시간

**Day 3 Afternoon 완료 기준**:

- ✅ 3개 시나리오 데모 스크립트
- ✅ Pitch Deck 완성
- ✅ 프로덕션 배포 완료
- ✅ Live demo 준비 완료

---

## 리스크 대응 전략

```yaml
# 리스크 매트릭스
risks:
  day_1:
    - risk: "x402 SDK 통합 실패"
      severity: "높음"
      mitigation: "Day 0에 미리 테스트"
      fallback: "Mock x402 server 사용 (402 응답 시뮬레이션)"
    - risk: "Policy Engine 복잡도"
      severity: "중간"
      mitigation: "MVP는 기본 기능만 (whitelist, budget)"
      defer: "Approval workflow, Anomaly detection (Post-hackathon)"
  day_2:
    - risk: "Redis 캐싱 이슈"
      severity: "중간"
      mitigation: "Upstash 대신 로컬 Redis (Docker)"
      fallback: "In-memory cache (Map)"
    - risk: "Analytics aggregation 성능"
      severity: "낮음"
      mitigation: "Hourly aggregation은 나중에, 실시간 쿼리만 사용"
      defer: "Background jobs (Post-hackathon)"
    - risk: "Curation 데이터 부족"
      severity: "중간"
      mitigation: "Seed data 생성 (synthetic metrics)"
      fallback: "Mock scores"
  day_3:
    - risk: "Dashboard UI 개발 시간 부족"
      severity: "중간"
      mitigation: "기본 table만 사용 (Tailwind CSS)"
      defer: "고급 charts, animations (Post-hackathon)"
    - risk: "배포 실패"
      severity: "높음"
      mitigation: "Day 2 저녁에 미리 배포 테스트"
      fallback: "localhost demo (녹화 영상)"
    - risk: "데모 시나리오 동작 안함"
      severity: "높음"
      mitigation: "사전 리허설 (Day 3 아침)"
      fallback: "녹화된 데모 비디오"
```

### Day 1 리스크

**리스크**: x402 SDK 통합 실패

- **대응**: Day 0에 미리 테스트
- **대안**: Mock x402 server 사용 (402 응답 시뮬레이션)

**리스크**: Policy Engine 복잡도

- **대응**: MVP는 기본 기능만 (whitelist, budget)
- **후순위**: Approval workflow, Anomaly detection (Post-hackathon)

### Day 2 리스크

**리스크**: Redis 캐싱 이슈

- **대응**: Upstash 대신 로컬 Redis (Docker)
- **대안**: In-memory cache (Map)

**리스크**: Analytics aggregation 성능

- **대응**: Hourly aggregation은 나중에, 실시간 쿼리만 사용
- **후순위**: Background jobs (Post-hackathon)

**리스크**: Curation 데이터 부족

- **대응**: Seed data 생성 (synthetic metrics)
- **대안**: Mock scores

### Day 3 리스크

**리스크**: Dashboard UI 개발 시간 부족

- **대응**: 기본 table만 사용 (Tailwind CSS)
- **후순위**: 고급 charts, animations (Post-hackathon)

**리스크**: 배포 실패

- **대응**: Day 2 저녁에 미리 배포 테스트
- **대안**: localhost demo (녹화 영상)

**리스크**: 데모 시나리오 동작 안함

- **대응**: 사전 리허설 (Day 3 아침)
- **대안**: 녹화된 데모 비디오

---

## 일일 체크리스트

### Day 1 종료 시

- [ ] Proxy endpoint 동작 (Postman 테스트)
- [ ] 402 응답 relay 확인
- [ ] Policy enforcement 동작 (budget, whitelist)
- [ ] PostgreSQL에 정책 저장됨
- [ ] Git commit + push

### Day 2 종료 시

- [ ] Cache hit/miss 동작
- [ ] Redis에 캐시 저장됨
- [ ] Analytics API 응답 정상
- [ ] Curation API 추천 동작
- [ ] Git commit + push
- [ ] 배포 테스트 (optional)

### Day 3 종료 시

- [ ] Dashboard UI 동작
- [ ] 3개 데모 시나리오 스크립트
- [ ] Pitch Deck 완성
- [ ] 프로덕션 배포 성공
- [ ] Live demo 준비 완료
- [ ] Git commit + push

---

## 최종 산출물

### 코드

- [ ] Backend (Bun + Hono) - GitHub repo
- [ ] Dashboard (Next.js) - GitHub repo
- [ ] Demo scripts - `/demo` 폴더

### 문서

- [ ] README.md (Getting Started)
- [ ] API 문서 (04-API-SPEC.md)
- [ ] 배포 가이드

### 데모

- [ ] Live demo URL (api.pag0.dev)
- [ ] Dashboard URL (app.pag0.dev)
- [ ] Demo 비디오 (optional)

### 발표

- [ ] Pitch Deck (PDF + Google Slides)
- [ ] 3-minute pitch 스크립트
- [ ] Q&A 준비 (FAQ)

---

**Good luck! 🚀**

**Version**: 1.0
**Last Updated**: 2026-02-10
