# Pag0 Smart Proxy - 데이터베이스 스키마

> **TL;DR**: PostgreSQL(Supabase) 10개 테이블 + Redis(Upstash) 6개 키 패턴으로 구성됩니다. 핵심 테이블은 users, projects, policies, budgets, requests이며, requests 테이블은 월별 파티셔닝으로 대량 데이터를 처리합니다. 모든 비용은 USDC 6 decimals를 BIGINT로 저장하며, SKALE 블록체인에 불변 감사 기록을 남깁니다.

## 관련 문서

| 문서 | 관련성 |
|------|--------|
| [03-TECH-SPEC.md](03-TECH-SPEC.md) | 아키텍처 및 데이터 흐름 |
| [04-API-SPEC.md](04-API-SPEC.md) | API에서 사용하는 데이터 구조 |
| [06-DEV-TASKS.md](06-DEV-TASKS.md) | DB 생성 태스크 순서 |
| [00-GLOSSARY.md](00-GLOSSARY.md) | 용어집 |

## 개요

**Primary Database**: PostgreSQL (Supabase)
**Cache Layer**: Redis (Upstash)
**Blockchain**: SKALE (on-chain metrics)

```yaml
# 데이터베이스 구조 요약
postgresql:
  테이블_수: 10
  핵심_테이블:
    - "users (사용자 계정)"
    - "projects (프로젝트)"
    - "policies (지출 정책)"
    - "budgets (예산 추적)"
    - "requests (요청 로그, 월별 파티셔닝)"
  집계_테이블:
    - "endpoint_metrics_hourly"
    - "endpoint_metrics_daily"
    - "endpoint_metrics_monthly"
  큐레이션_테이블:
    - "endpoint_scores"
    - "categories"
redis:
  키_패턴_수: 6
  패턴:
    - "cache:{hash} - 응답 캐시"
    - "budget:{projectId}:{period} - 예산 추적"
    - "rate:{projectId}:{window} - Rate Limiting"
    - "score:{endpoint} - 점수 캐시"
    - "metrics:{projectId}:{endpoint}:hourly - 실시간 카운터"
    - "nonce:{paymentId} - Replay 방지"
skale:
  용도: "불변 온체인 메트릭 감사 기록"
```

---

## 1. PostgreSQL 스키마

### 1.1 users

사용자 계정 정보.

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  api_key_hash VARCHAR(64) NOT NULL UNIQUE,  -- SHA-256 hash
  subscription_tier VARCHAR(20) NOT NULL DEFAULT 'free',  -- 'free' | 'pro'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  CONSTRAINT check_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_api_key_hash ON users(api_key_hash);
CREATE INDEX idx_users_created_at ON users(created_at DESC);

-- Comments
COMMENT ON TABLE users IS 'User accounts and authentication';
COMMENT ON COLUMN users.api_key_hash IS 'SHA-256 hash of API key (pag0_live_xxx)';
COMMENT ON COLUMN users.subscription_tier IS 'Subscription tier: free (1K req/day) or pro (unlimited)';
```

---

### 1.2 projects

사용자의 프로젝트 (API Key scope).

```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_is_active ON projects(is_active) WHERE is_active = true;

-- Comments
COMMENT ON TABLE projects IS 'User projects (1 user : N projects)';
COMMENT ON COLUMN projects.is_active IS 'Soft delete flag';
```

---

### 1.3 policies

지출 정책 설정.

```sql
CREATE TABLE policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Budget limits (USDC, 6 decimals stored as BIGINT)
  max_per_request BIGINT NOT NULL DEFAULT 1000000,  -- 1 USDC
  daily_budget BIGINT NOT NULL DEFAULT 10000000,    -- 10 USDC
  monthly_budget BIGINT NOT NULL DEFAULT 100000000, -- 100 USDC

  -- Endpoint filtering (JSONB arrays)
  allowed_endpoints JSONB NOT NULL DEFAULT '[]'::jsonb,
  blocked_endpoints JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Approval workflow (JSONB)
  require_approval JSONB,  -- { threshold, webhookUrl, timeoutSeconds }

  -- Anomaly detection (JSONB)
  anomaly_detection JSONB, -- { enabled, maxDeviationPercent, alertWebhook }

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  CONSTRAINT check_budget_positive CHECK (
    max_per_request > 0 AND daily_budget > 0 AND monthly_budget > 0
  ),
  CONSTRAINT check_budget_hierarchy CHECK (
    max_per_request <= daily_budget AND daily_budget <= monthly_budget
  )
);

-- Indexes
CREATE INDEX idx_policies_project_id ON policies(project_id);
CREATE INDEX idx_policies_is_active ON policies(is_active) WHERE is_active = true;
CREATE INDEX idx_policies_project_active ON policies(project_id, is_active)
  WHERE is_active = true;

-- Partial unique index: only one active policy per project
CREATE UNIQUE INDEX idx_policies_project_active_unique
  ON policies(project_id)
  WHERE is_active = true;

-- GIN index for JSONB queries
CREATE INDEX idx_policies_allowed_endpoints ON policies USING GIN (allowed_endpoints);
CREATE INDEX idx_policies_blocked_endpoints ON policies USING GIN (blocked_endpoints);

-- Comments
COMMENT ON TABLE policies IS 'Spend policies for budget control';
COMMENT ON COLUMN policies.max_per_request IS 'Max USDC per request (6 decimals, stored as BIGINT)';
COMMENT ON COLUMN policies.allowed_endpoints IS 'Whitelist: ["api.example.com", "*.openai.com"]';
COMMENT ON COLUMN policies.blocked_endpoints IS 'Blacklist: ["forbidden.com"]';
COMMENT ON COLUMN policies.require_approval IS 'Approval workflow config: { threshold: "5000000", webhookUrl: "https://...", timeoutSeconds: 300 }';
COMMENT ON COLUMN policies.anomaly_detection IS 'Anomaly detection config: { enabled: true, maxDeviationPercent: 200, alertWebhook: "https://..." }';
```

---

### 1.4 budgets

일일/월별 예산 추적 (실시간 카운터).

```sql
CREATE TABLE budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  -- Daily tracking
  daily_spent BIGINT NOT NULL DEFAULT 0,
  last_reset_daily DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Monthly tracking
  monthly_spent BIGINT NOT NULL DEFAULT 0,
  last_reset_monthly DATE NOT NULL DEFAULT DATE_TRUNC('month', CURRENT_DATE),

  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  CONSTRAINT check_spent_non_negative CHECK (
    daily_spent >= 0 AND monthly_spent >= 0
  )
);

-- Indexes
CREATE UNIQUE INDEX idx_budgets_project_id ON budgets(project_id);
CREATE INDEX idx_budgets_last_reset_daily ON budgets(last_reset_daily);
CREATE INDEX idx_budgets_last_reset_monthly ON budgets(last_reset_monthly);

-- Comments
COMMENT ON TABLE budgets IS 'Real-time budget tracking (daily/monthly)';
COMMENT ON COLUMN budgets.daily_spent IS 'USDC spent today (6 decimals)';
COMMENT ON COLUMN budgets.monthly_spent IS 'USDC spent this month (6 decimals)';
COMMENT ON COLUMN budgets.last_reset_daily IS 'Last daily reset date (UTC midnight)';
COMMENT ON COLUMN budgets.last_reset_monthly IS 'Last monthly reset date (first day of month)';

-- Trigger: Auto-reset daily/monthly budgets
CREATE OR REPLACE FUNCTION reset_budgets()
RETURNS TRIGGER AS $$
BEGIN
  -- Reset daily if date changed
  IF NEW.last_reset_daily < CURRENT_DATE THEN
    NEW.daily_spent = 0;
    NEW.last_reset_daily = CURRENT_DATE;
  END IF;

  -- Reset monthly if month changed
  IF NEW.last_reset_monthly < DATE_TRUNC('month', CURRENT_DATE) THEN
    NEW.monthly_spent = 0;
    NEW.last_reset_monthly = DATE_TRUNC('month', CURRENT_DATE);
  END IF;

  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_reset_budgets
  BEFORE UPDATE ON budgets
  FOR EACH ROW
  EXECUTE FUNCTION reset_budgets();
```

---

### 1.5 requests

개별 요청 로그 (raw data).

```sql
CREATE TABLE requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  -- Request details
  endpoint VARCHAR(500) NOT NULL,  -- Normalized hostname
  full_url TEXT NOT NULL,
  method VARCHAR(10) NOT NULL,     -- GET, POST, PUT, DELETE

  -- Response details
  status_code INTEGER NOT NULL,
  cost BIGINT NOT NULL DEFAULT 0,  -- USDC (6 decimals), 0 if cached
  cached BOOLEAN NOT NULL DEFAULT false,

  -- Performance metrics
  latency_ms INTEGER NOT NULL,     -- Total latency (cache or proxy)

  -- Metadata
  policy_id UUID REFERENCES policies(id) ON DELETE SET NULL,
  cache_key VARCHAR(64),           -- SHA-256 hash (if cached)

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  CONSTRAINT check_status_code CHECK (status_code >= 100 AND status_code < 600),
  CONSTRAINT check_cost_non_negative CHECK (cost >= 0),
  CONSTRAINT check_latency_positive CHECK (latency_ms > 0)
);

-- Indexes
CREATE INDEX idx_requests_project_id ON requests(project_id);
CREATE INDEX idx_requests_endpoint ON requests(endpoint);
CREATE INDEX idx_requests_created_at ON requests(created_at DESC);
CREATE INDEX idx_requests_project_created ON requests(project_id, created_at DESC);
CREATE INDEX idx_requests_endpoint_created ON requests(endpoint, created_at DESC);
CREATE INDEX idx_requests_cached ON requests(cached) WHERE cached = true;

-- Composite index for analytics queries
CREATE INDEX idx_requests_analytics
  ON requests(project_id, endpoint, created_at DESC)
  INCLUDE (status_code, cost, cached, latency_ms);

-- Comments
COMMENT ON TABLE requests IS 'Raw request logs for analytics';
COMMENT ON COLUMN requests.endpoint IS 'Normalized hostname (e.g., api.openai.com)';
COMMENT ON COLUMN requests.full_url IS 'Complete URL including path and query';
COMMENT ON COLUMN requests.cost IS 'USDC cost (6 decimals), 0 if cache hit';
COMMENT ON COLUMN requests.cached IS 'true if served from cache';
COMMENT ON COLUMN requests.latency_ms IS 'Total latency in milliseconds';

-- Partition by month (for performance)
-- Note: Requires PostgreSQL 10+
CREATE TABLE requests_2026_02 PARTITION OF requests
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

CREATE TABLE requests_2026_03 PARTITION OF requests
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

-- Auto-create future partitions (cron job or trigger)
```

---

### 1.6 endpoint_metrics_hourly

시간별 집계 메트릭.

```sql
CREATE TABLE endpoint_metrics_hourly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  endpoint VARCHAR(500) NOT NULL,
  hour_bucket TIMESTAMP WITH TIME ZONE NOT NULL,  -- Hourly bucket (truncated)

  -- Request counts
  request_count INTEGER NOT NULL DEFAULT 0,
  cache_hit_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,        -- 4xx + 5xx

  -- Latency metrics (milliseconds)
  avg_latency_ms NUMERIC(10, 2) NOT NULL,
  p50_latency_ms INTEGER NOT NULL,
  p95_latency_ms INTEGER NOT NULL,
  p99_latency_ms INTEGER NOT NULL,
  min_latency_ms INTEGER NOT NULL,
  max_latency_ms INTEGER NOT NULL,

  -- Cost metrics (USDC, 6 decimals)
  total_spent BIGINT NOT NULL DEFAULT 0,
  cache_savings BIGINT NOT NULL DEFAULT 0,       -- Cost saved by cache

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  CONSTRAINT check_counts_non_negative CHECK (
    request_count >= 0 AND cache_hit_count >= 0 AND error_count >= 0
  ),
  CONSTRAINT check_cache_hit_count CHECK (cache_hit_count <= request_count),
  CONSTRAINT check_error_count CHECK (error_count <= request_count),

  -- Unique constraint: one row per (project, endpoint, hour)
  UNIQUE (project_id, endpoint, hour_bucket)
);

-- Indexes
CREATE INDEX idx_metrics_hourly_project_hour
  ON endpoint_metrics_hourly(project_id, hour_bucket DESC);
CREATE INDEX idx_metrics_hourly_endpoint_hour
  ON endpoint_metrics_hourly(endpoint, hour_bucket DESC);
CREATE INDEX idx_metrics_hourly_hour
  ON endpoint_metrics_hourly(hour_bucket DESC);

-- Comments
COMMENT ON TABLE endpoint_metrics_hourly IS 'Hourly aggregated metrics per endpoint';
COMMENT ON COLUMN endpoint_metrics_hourly.hour_bucket IS 'Hourly bucket (date_trunc(hour, timestamp))';
COMMENT ON COLUMN endpoint_metrics_hourly.cache_savings IS 'USDC saved by cache hits (estimated)';
```

---

### 1.7 endpoint_metrics_daily

일별 집계 메트릭.

```sql
CREATE TABLE endpoint_metrics_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  endpoint VARCHAR(500) NOT NULL,
  day_bucket DATE NOT NULL,

  -- Request counts
  request_count INTEGER NOT NULL DEFAULT 0,
  cache_hit_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,

  -- Latency metrics
  avg_latency_ms NUMERIC(10, 2) NOT NULL,
  p50_latency_ms INTEGER NOT NULL,
  p95_latency_ms INTEGER NOT NULL,
  p99_latency_ms INTEGER NOT NULL,
  min_latency_ms INTEGER NOT NULL,
  max_latency_ms INTEGER NOT NULL,

  -- Cost metrics
  total_spent BIGINT NOT NULL DEFAULT 0,
  cache_savings BIGINT NOT NULL DEFAULT 0,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  CONSTRAINT check_counts_non_negative CHECK (
    request_count >= 0 AND cache_hit_count >= 0 AND error_count >= 0
  ),

  UNIQUE (project_id, endpoint, day_bucket)
);

-- Indexes
CREATE INDEX idx_metrics_daily_project_day
  ON endpoint_metrics_daily(project_id, day_bucket DESC);
CREATE INDEX idx_metrics_daily_endpoint_day
  ON endpoint_metrics_daily(endpoint, day_bucket DESC);

-- Comments
COMMENT ON TABLE endpoint_metrics_daily IS 'Daily aggregated metrics per endpoint';
```

---

### 1.8 endpoint_metrics_monthly

월별 집계 메트릭.

```sql
CREATE TABLE endpoint_metrics_monthly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  endpoint VARCHAR(500) NOT NULL,
  month_bucket DATE NOT NULL,  -- First day of month

  -- Request counts
  request_count INTEGER NOT NULL DEFAULT 0,
  cache_hit_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,

  -- Latency metrics
  avg_latency_ms NUMERIC(10, 2) NOT NULL,
  p50_latency_ms INTEGER NOT NULL,
  p95_latency_ms INTEGER NOT NULL,
  p99_latency_ms INTEGER NOT NULL,
  min_latency_ms INTEGER NOT NULL,
  max_latency_ms INTEGER NOT NULL,

  -- Cost metrics
  total_spent BIGINT NOT NULL DEFAULT 0,
  cache_savings BIGINT NOT NULL DEFAULT 0,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  UNIQUE (project_id, endpoint, month_bucket)
);

-- Indexes
CREATE INDEX idx_metrics_monthly_project_month
  ON endpoint_metrics_monthly(project_id, month_bucket DESC);
CREATE INDEX idx_metrics_monthly_endpoint_month
  ON endpoint_metrics_monthly(endpoint, month_bucket DESC);

-- Comments
COMMENT ON TABLE endpoint_metrics_monthly IS 'Monthly aggregated metrics per endpoint';
```

---

### 1.9 endpoint_scores

큐레이션 점수 (전체 사용자 데이터 기반).

```sql
CREATE TABLE endpoint_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint VARCHAR(500) NOT NULL UNIQUE,
  category VARCHAR(100) NOT NULL,  -- AI, Data, Blockchain, etc.

  -- Composite scores (0-100)
  overall_score NUMERIC(5, 2) NOT NULL,
  cost_score NUMERIC(5, 2) NOT NULL,
  latency_score NUMERIC(5, 2) NOT NULL,
  reliability_score NUMERIC(5, 2) NOT NULL,

  -- Score weights (JSONB)
  weights JSONB NOT NULL DEFAULT '{"cost": 0.4, "latency": 0.3, "reliability": 0.3}'::jsonb,

  -- Evidence data (JSONB)
  evidence JSONB NOT NULL,  -- { sampleSize, period, avgCostPerRequest, avgLatencyMs, successRate }

  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  CONSTRAINT check_scores_range CHECK (
    overall_score >= 0 AND overall_score <= 100 AND
    cost_score >= 0 AND cost_score <= 100 AND
    latency_score >= 0 AND latency_score <= 100 AND
    reliability_score >= 0 AND reliability_score <= 100
  )
);

-- Indexes
CREATE INDEX idx_endpoint_scores_category ON endpoint_scores(category);
CREATE INDEX idx_endpoint_scores_overall ON endpoint_scores(overall_score DESC);
CREATE INDEX idx_endpoint_scores_category_overall
  ON endpoint_scores(category, overall_score DESC);
CREATE INDEX idx_endpoint_scores_updated_at ON endpoint_scores(updated_at DESC);

-- GIN index for JSONB
CREATE INDEX idx_endpoint_scores_evidence ON endpoint_scores USING GIN (evidence);

-- Comments
COMMENT ON TABLE endpoint_scores IS 'Curation scores for all endpoints (global data)';
COMMENT ON COLUMN endpoint_scores.overall_score IS 'Weighted composite score (0-100)';
COMMENT ON COLUMN endpoint_scores.weights IS 'Score weights: { cost, latency, reliability }';
COMMENT ON COLUMN endpoint_scores.evidence IS 'Supporting data: { sampleSize, period, avgCostPerRequest, avgLatencyMs, successRate }';
```

---

### 1.10 categories

카테고리 메타데이터.

```sql
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  endpoint_count INTEGER NOT NULL DEFAULT 0,
  avg_score NUMERIC(5, 2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Seed data
INSERT INTO categories (name, description) VALUES
  ('AI', 'AI and Machine Learning APIs'),
  ('Data', 'Data and Analytics APIs'),
  ('Blockchain', 'Blockchain and Web3 APIs'),
  ('IoT', 'Internet of Things APIs'),
  ('Finance', 'Financial and Payment APIs'),
  ('Social', 'Social Media APIs'),
  ('Communication', 'Messaging and Communication APIs'),
  ('Storage', 'Cloud Storage APIs');

-- Comments
COMMENT ON TABLE categories IS 'API categories for curation';
```

---

## 2. Redis 키 구조

### 2.1 Cache

```
Key Pattern: cache:{hash}
Type: String (JSON serialized)
TTL: Configurable (default: 300s)
Example: cache:a1b2c3d4e5f6... → {"status":200,"body":{...}}
```

**키 생성 로직**:

```typescript
const content = method === "GET"
  ? `${url}:${method}`
  : `${url}:${method}:${JSON.stringify(body)}`;
const hash = crypto.createHash('sha256').update(content).digest('hex');
const key = `cache:${hash}`;
```

---

### 2.2 Budget Tracking

```
Key Pattern: budget:{projectId}:daily
Type: String (BIGINT as string)
TTL: Until UTC midnight
Example: budget:proj_xyz789:daily → "1200000"

Key Pattern: budget:{projectId}:monthly
Type: String (BIGINT as string)
TTL: Until end of month
Example: budget:proj_xyz789:monthly → "7850000"
```

**리셋 로직**:

```typescript
// Daily reset at midnight UTC
const ttl = Math.floor((Date.now() - new Date().setUTCHours(0,0,0,0)) / 1000);
await redis.setex(`budget:${projectId}:daily`, ttl, spent.toString());

// Monthly reset at end of month
const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
const monthlyTtl = Math.floor((endOfMonth.getTime() - Date.now()) / 1000);
await redis.setex(`budget:${projectId}:monthly`, monthlyTtl, spent.toString());
```

---

### 2.3 Rate Limiting

```
Key Pattern: rate:{projectId}:{window}
Type: String (counter)
TTL: 60 seconds
Example: rate:proj_xyz789:1707580740 → "42"
```

**Rate limit 체크**:

```typescript
const window = Math.floor(Date.now() / 60000); // 1-minute window
const key = `rate:${projectId}:${window}`;
const count = await redis.incr(key);
await redis.expire(key, 60);

if (count > maxRequestsPerMinute) {
  throw new RateLimitError();
}
```

---

### 2.4 Score Caching

```
Key Pattern: score:{endpoint}
Type: String (JSON serialized)
TTL: 300 seconds (5 minutes)
Example: score:api.openai.com → {"overallScore":85,...}
```

---

### 2.5 Real-time Counters

```
Key Pattern: metrics:{projectId}:{endpoint}:hourly
Type: Hash
TTL: 7200 seconds (2 hours)
Fields:
  - requestCount: Integer
  - cacheHitCount: Integer
  - errorCount: Integer
  - totalSpent: Float (USDC)
  - totalLatency: Integer (sum for avg calculation)

Example:
  HGET metrics:proj_xyz:api.openai.com:hourly requestCount → "150"
```

**업데이트 로직**:

```typescript
await redis
  .multi()
  .hincrby(key, 'requestCount', 1)
  .hincrby(key, 'cacheHitCount', cached ? 1 : 0)
  .hincrby(key, 'errorCount', statusCode >= 400 ? 1 : 0)
  .hincrbyfloat(key, 'totalSpent', parseFloat(cost))
  .hincrby(key, 'totalLatency', latencyMs)
  .expire(key, 7200)
  .exec();
```

---

### 2.6 Nonce (Replay Prevention)

```
Key Pattern: nonce:{paymentId}
Type: String ("1")
TTL: 3600 seconds (1 hour)
Example: nonce:pay_abc123 → "1"
```

**체크 로직**:

```typescript
const key = `nonce:${paymentId}`;
const exists = await redis.get(key);
if (exists) {
  throw new ReplayAttackError();
}
await redis.setex(key, 3600, '1');
```

---

## 3. 인덱스 전략

### 3.1 기본 인덱스

자주 조회되는 컬럼에 대한 인덱스:

- `users.email`, `users.api_key_hash` → 인증
- `projects.user_id` → 사용자별 프로젝트 조회
- `policies.project_id`, `policies.is_active` → 활성 정책 조회
- `requests.project_id`, `requests.created_at` → 시계열 분석

### 3.2 복합 인덱스

복합 쿼리 최적화:

- `requests(project_id, created_at DESC)` → 프로젝트별 최근 요청
- `requests(endpoint, created_at DESC)` → 엔드포인트별 히스토리
- `endpoint_scores(category, overall_score DESC)` → 카테고리별 랭킹

### 3.3 부분 인덱스

조건부 인덱스로 크기 최적화:

- `policies(is_active)` WHERE `is_active = true` → 활성 정책만
- `requests(cached)` WHERE `cached = true` → 캐시 히트만

### 3.4 GIN 인덱스 (JSONB)

JSONB 쿼리 최적화:

- `policies.allowed_endpoints` → `WHERE 'api.com' = ANY(allowed_endpoints)`
- `endpoint_scores.evidence` → JSON 필드 검색

---

## 4. 마이그레이션 가이드

### 4.1 초기 설정

```sql
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create schema
CREATE SCHEMA IF NOT EXISTS pag0;
SET search_path TO pag0, public;

-- Run table creation scripts (in order)
-- 1. users
-- 2. projects
-- 3. policies
-- 4. budgets
-- 5. requests (with partitions)
-- 6. endpoint_metrics_*
-- 7. endpoint_scores
-- 8. categories

-- Create functions and triggers
-- (reset_budgets trigger)

-- Seed data
-- (categories)
```

### 4.2 데이터 보관 정책

```yaml
# 데이터 보관 기간
data_retention:
  requests: "90일 (원시 로그)"
  endpoint_metrics_hourly: "7일"
  endpoint_metrics_daily: "30일"
  endpoint_metrics_monthly: "1년"
  endpoint_scores: "영구 (업데이트)"
  users_projects_policies: "영구"
```

```sql
-- Delete old requests (keep 90 days)
DELETE FROM requests
WHERE created_at < NOW() - INTERVAL '90 days';

-- Aggregate to monthly and delete hourly (keep 7 days)
DELETE FROM endpoint_metrics_hourly
WHERE hour_bucket < NOW() - INTERVAL '7 days';

-- Keep daily for 30 days, monthly for 1 year
```

### 4.3 백업 전략

- **PostgreSQL**: Daily full backup (Supabase automatic)
- **Redis**: AOF (Append-Only File) enabled
- **Critical tables**: `users`, `projects`, `policies`, `budgets`

### 4.4 성능 튜닝

```sql
-- Vacuum and analyze regularly
VACUUM ANALYZE requests;
ANALYZE endpoint_metrics_hourly;

-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC;

-- Unused indexes (consider dropping)
SELECT schemaname, tablename, indexname
FROM pg_stat_user_indexes
WHERE idx_scan = 0 AND indexname NOT LIKE '%_pkey';
```

---

## 5. 쿼리 예시

### 5.1 Get Active Policy for Project

```sql
SELECT * FROM policies
WHERE project_id = $1 AND is_active = true
LIMIT 1;
```

### 5.2 Log Request

```sql
INSERT INTO requests (
  project_id, endpoint, full_url, method, status_code,
  cost, cached, latency_ms, policy_id, cache_key
) VALUES (
  $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
)
RETURNING id;
```

### 5.3 Get Analytics Summary (7 days)

```sql
SELECT
  COUNT(*) as total_requests,
  SUM(CASE WHEN cached THEN 1 ELSE 0 END)::float / COUNT(*) as cache_hit_rate,
  AVG(latency_ms) as avg_latency,
  SUM(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 ELSE 0 END)::float / COUNT(*) as success_rate,
  SUM(cost) as total_cost,
  SUM(CASE WHEN cached THEN cost ELSE 0 END) as cache_savings
FROM requests
WHERE project_id = $1
  AND created_at >= NOW() - INTERVAL '7 days';
```

### 5.4 Get Top Endpoints by Cost

```sql
SELECT
  endpoint,
  COUNT(*) as request_count,
  SUM(cost) as total_cost
FROM requests
WHERE project_id = $1
  AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY endpoint
ORDER BY total_cost DESC
LIMIT 10;
```

### 5.5 Get Endpoint Metrics (30 days)

```sql
SELECT
  endpoint,
  COUNT(*) as request_count,
  SUM(CASE WHEN cached THEN 1 ELSE 0 END) as cache_hit_count,
  AVG(latency_ms) as avg_latency_ms,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY latency_ms) as p50_latency_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) as p95_latency_ms,
  PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY latency_ms) as p99_latency_ms,
  SUM(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 ELSE 0 END)::float / COUNT(*) as success_rate,
  SUM(cost) as total_spent,
  SUM(CASE WHEN cached THEN cost ELSE 0 END) as cache_savings
FROM requests
WHERE endpoint = $1
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY endpoint;
```

### 5.6 Update Budget (Atomic)

```sql
UPDATE budgets
SET
  daily_spent = daily_spent + $2,
  monthly_spent = monthly_spent + $2,
  updated_at = NOW()
WHERE project_id = $1
RETURNING daily_spent, monthly_spent;
```

### 5.7 Get Top Scored Endpoints by Category

```sql
SELECT * FROM endpoint_scores
WHERE category = $1
ORDER BY overall_score DESC
LIMIT $2;
```

### 5.8 Calculate Endpoint Score

```sql
-- Get metrics for scoring
SELECT
  endpoint,
  COUNT(*) as sample_size,
  AVG(cost::numeric / 1000000) as avg_cost_per_request,  -- Convert to USDC
  AVG(latency_ms) as avg_latency_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) as p95_latency_ms,
  SUM(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 ELSE 0 END)::float / COUNT(*) as success_rate
FROM requests
WHERE endpoint = $1
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY endpoint
HAVING COUNT(*) >= 10;  -- Minimum sample size
```

---

## 6. 데이터 타입 참조

### 6.1 USDC Storage

모든 비용은 **6 decimals** (USDC 표준)을 `BIGINT`로 저장:

```
1 USDC = 1,000,000 (stored value)
0.5 USDC = 500,000
0.000001 USDC = 1 (minimum unit)
```

**TypeScript 변환**:

```typescript
// Store
const storedValue = Math.floor(parseFloat(usdc) * 1_000_000);

// Retrieve
const usdc = (storedValue / 1_000_000).toFixed(6);
```

### 6.2 Timestamp

모든 timestamp는 `TIMESTAMP WITH TIME ZONE` (UTC 저장):

```sql
created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
```

---

## 7. 보안 고려사항

### 7.1 API Key 저장

- **Never store plain API keys**
- Store SHA-256 hash only
- Use bcrypt for password hashing

```sql
-- Generate API key hash
api_key_hash = SHA256(api_key)

-- Password hash (application layer)
password_hash = bcrypt.hash(password, 12)
```

### 7.2 행 수준 보안 (RLS)

```sql
-- Enable RLS on sensitive tables
ALTER TABLE policies ENABLE ROW LEVEL SECURITY;

-- Policy: users can only see their own projects
CREATE POLICY user_projects ON projects
  FOR ALL
  USING (user_id = current_setting('app.user_id')::uuid);
```

### 7.3 데이터 암호화

- **At rest**: Supabase default encryption
- **In transit**: TLS 1.3
- **Sensitive columns**: Consider `pgcrypto` for PII

---

**Version**: 1.0
**Last Updated**: 2026-02-10
