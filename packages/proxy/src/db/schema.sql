-- Pag0 Smart Proxy — Database Schema
-- Idempotent: safe to run multiple times

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  api_key_hash VARCHAR(64) UNIQUE,
  subscription_tier VARCHAR(20) NOT NULL DEFAULT 'free',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT check_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_api_key_hash ON users(api_key_hash);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);

-- 2. projects
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_is_active ON projects(is_active) WHERE is_active = true;

-- 3. policies
CREATE TABLE IF NOT EXISTS policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  max_per_request BIGINT NOT NULL DEFAULT 1000000,
  daily_budget BIGINT NOT NULL DEFAULT 10000000,
  monthly_budget BIGINT NOT NULL DEFAULT 100000000,
  allowed_endpoints JSONB NOT NULL DEFAULT '[]'::jsonb,
  blocked_endpoints JSONB NOT NULL DEFAULT '[]'::jsonb,
  require_approval JSONB,
  anomaly_detection JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT check_budget_positive CHECK (
    max_per_request > 0 AND daily_budget > 0 AND monthly_budget > 0
  ),
  CONSTRAINT check_budget_hierarchy CHECK (
    max_per_request <= daily_budget AND daily_budget <= monthly_budget
  )
);

CREATE INDEX IF NOT EXISTS idx_policies_project_id ON policies(project_id);
CREATE INDEX IF NOT EXISTS idx_policies_is_active ON policies(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_policies_project_active ON policies(project_id, is_active) WHERE is_active = true;
CREATE UNIQUE INDEX IF NOT EXISTS idx_policies_project_active_unique ON policies(project_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_policies_allowed_endpoints ON policies USING GIN (allowed_endpoints);
CREATE INDEX IF NOT EXISTS idx_policies_blocked_endpoints ON policies USING GIN (blocked_endpoints);

-- 4. budgets
CREATE TABLE IF NOT EXISTS budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  daily_spent BIGINT NOT NULL DEFAULT 0,
  last_reset_daily DATE NOT NULL DEFAULT CURRENT_DATE,
  monthly_spent BIGINT NOT NULL DEFAULT 0,
  last_reset_monthly DATE NOT NULL DEFAULT DATE_TRUNC('month', CURRENT_DATE),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT check_spent_non_negative CHECK (
    daily_spent >= 0 AND monthly_spent >= 0
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_budgets_project_id ON budgets(project_id);
CREATE INDEX IF NOT EXISTS idx_budgets_last_reset_daily ON budgets(last_reset_daily);
CREATE INDEX IF NOT EXISTS idx_budgets_last_reset_monthly ON budgets(last_reset_monthly);

-- Budget auto-reset trigger
CREATE OR REPLACE FUNCTION reset_budgets()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.last_reset_daily < CURRENT_DATE THEN
    NEW.daily_spent = 0;
    NEW.last_reset_daily = CURRENT_DATE;
  END IF;
  IF NEW.last_reset_monthly < DATE_TRUNC('month', CURRENT_DATE) THEN
    NEW.monthly_spent = 0;
    NEW.last_reset_monthly = DATE_TRUNC('month', CURRENT_DATE);
  END IF;
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_reset_budgets ON budgets;
CREATE TRIGGER trigger_reset_budgets
  BEFORE UPDATE ON budgets
  FOR EACH ROW
  EXECUTE FUNCTION reset_budgets();

-- 5. requests (no partitioning for local dev)
CREATE TABLE IF NOT EXISTS requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  endpoint VARCHAR(500) NOT NULL,
  full_url TEXT NOT NULL,
  method VARCHAR(10) NOT NULL,
  status_code INTEGER NOT NULL,
  cost BIGINT NOT NULL DEFAULT 0,
  cached BOOLEAN NOT NULL DEFAULT false,
  latency_ms INTEGER NOT NULL,
  policy_id UUID REFERENCES policies(id) ON DELETE SET NULL,
  cache_key VARCHAR(64),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT check_status_code CHECK (status_code >= 100 AND status_code < 600),
  CONSTRAINT check_cost_non_negative CHECK (cost >= 0),
  CONSTRAINT check_latency_positive CHECK (latency_ms > 0)
);

CREATE INDEX IF NOT EXISTS idx_requests_project_id ON requests(project_id);
CREATE INDEX IF NOT EXISTS idx_requests_endpoint ON requests(endpoint);
CREATE INDEX IF NOT EXISTS idx_requests_created_at ON requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_requests_project_created ON requests(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_requests_endpoint_created ON requests(endpoint, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_requests_cached ON requests(cached) WHERE cached = true;
CREATE INDEX IF NOT EXISTS idx_requests_analytics ON requests(project_id, endpoint, created_at DESC) INCLUDE (status_code, cost, cached, latency_ms);

-- 6. endpoint_metrics_hourly
CREATE TABLE IF NOT EXISTS endpoint_metrics_hourly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  endpoint VARCHAR(500) NOT NULL,
  hour_bucket TIMESTAMP WITH TIME ZONE NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  cache_hit_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  avg_latency_ms NUMERIC(10, 2) NOT NULL,
  p50_latency_ms INTEGER NOT NULL,
  p95_latency_ms INTEGER NOT NULL,
  p99_latency_ms INTEGER NOT NULL,
  min_latency_ms INTEGER NOT NULL,
  max_latency_ms INTEGER NOT NULL,
  total_spent BIGINT NOT NULL DEFAULT 0,
  cache_savings BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT check_hourly_counts_non_negative CHECK (
    request_count >= 0 AND cache_hit_count >= 0 AND error_count >= 0
  ),
  CONSTRAINT check_hourly_cache_hit_count CHECK (cache_hit_count <= request_count),
  CONSTRAINT check_hourly_error_count CHECK (error_count <= request_count),
  UNIQUE (project_id, endpoint, hour_bucket)
);

CREATE INDEX IF NOT EXISTS idx_metrics_hourly_project_hour ON endpoint_metrics_hourly(project_id, hour_bucket DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_hourly_endpoint_hour ON endpoint_metrics_hourly(endpoint, hour_bucket DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_hourly_hour ON endpoint_metrics_hourly(hour_bucket DESC);

-- 7. endpoint_metrics_daily
CREATE TABLE IF NOT EXISTS endpoint_metrics_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  endpoint VARCHAR(500) NOT NULL,
  day_bucket DATE NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  cache_hit_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  avg_latency_ms NUMERIC(10, 2) NOT NULL,
  p50_latency_ms INTEGER NOT NULL,
  p95_latency_ms INTEGER NOT NULL,
  p99_latency_ms INTEGER NOT NULL,
  min_latency_ms INTEGER NOT NULL,
  max_latency_ms INTEGER NOT NULL,
  total_spent BIGINT NOT NULL DEFAULT 0,
  cache_savings BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT check_daily_counts_non_negative CHECK (
    request_count >= 0 AND cache_hit_count >= 0 AND error_count >= 0
  ),
  UNIQUE (project_id, endpoint, day_bucket)
);

CREATE INDEX IF NOT EXISTS idx_metrics_daily_project_day ON endpoint_metrics_daily(project_id, day_bucket DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_daily_endpoint_day ON endpoint_metrics_daily(endpoint, day_bucket DESC);

-- 8. endpoint_metrics_monthly
CREATE TABLE IF NOT EXISTS endpoint_metrics_monthly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  endpoint VARCHAR(500) NOT NULL,
  month_bucket DATE NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  cache_hit_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  avg_latency_ms NUMERIC(10, 2) NOT NULL,
  p50_latency_ms INTEGER NOT NULL,
  p95_latency_ms INTEGER NOT NULL,
  p99_latency_ms INTEGER NOT NULL,
  min_latency_ms INTEGER NOT NULL,
  max_latency_ms INTEGER NOT NULL,
  total_spent BIGINT NOT NULL DEFAULT 0,
  cache_savings BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, endpoint, month_bucket)
);

CREATE INDEX IF NOT EXISTS idx_metrics_monthly_project_month ON endpoint_metrics_monthly(project_id, month_bucket DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_monthly_endpoint_month ON endpoint_metrics_monthly(endpoint, month_bucket DESC);

-- 9. endpoint_scores
CREATE TABLE IF NOT EXISTS endpoint_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint VARCHAR(500) NOT NULL UNIQUE,
  category VARCHAR(100) NOT NULL,
  overall_score NUMERIC(5, 2) NOT NULL,
  cost_score NUMERIC(5, 2) NOT NULL,
  latency_score NUMERIC(5, 2) NOT NULL,
  reliability_score NUMERIC(5, 2) NOT NULL,
  weights JSONB NOT NULL DEFAULT '{"cost": 0.4, "latency": 0.3, "reliability": 0.3}'::jsonb,
  evidence JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT check_scores_range CHECK (
    overall_score >= 0 AND overall_score <= 100 AND
    cost_score >= 0 AND cost_score <= 100 AND
    latency_score >= 0 AND latency_score <= 100 AND
    reliability_score >= 0 AND reliability_score <= 100
  )
);

CREATE INDEX IF NOT EXISTS idx_endpoint_scores_category ON endpoint_scores(category);
CREATE INDEX IF NOT EXISTS idx_endpoint_scores_overall ON endpoint_scores(overall_score DESC);
CREATE INDEX IF NOT EXISTS idx_endpoint_scores_category_overall ON endpoint_scores(category, overall_score DESC);
CREATE INDEX IF NOT EXISTS idx_endpoint_scores_updated_at ON endpoint_scores(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_endpoint_scores_evidence ON endpoint_scores USING GIN (evidence);

-- 10. categories
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  endpoint_count INTEGER NOT NULL DEFAULT 0,
  avg_score NUMERIC(5, 2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
