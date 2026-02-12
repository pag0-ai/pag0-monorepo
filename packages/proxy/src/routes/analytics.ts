import { Hono } from 'hono';
import sql from '../db/postgres';
import type { UsdcAmount } from '../types';

// ─── Context Variables ───────────────────────────────────

type Variables = {
  user: {
    id: string;
    email: string;
    tier: 'free' | 'pro' | 'enterprise';
  };
  projectId: string;
};

// ─── Types ───────────────────────────────────────────────

interface SummaryResponse {
  period: string;
  totalRequests: number;
  cacheHitRate: number;
  avgLatency: number;
  successRate: number;
  totalCost: string;
  cacheSavings: string;
  topEndpoints: Array<{
    endpoint: string;
    requestCount: number;
    cost: string;
  }>;
  budgetUsage: {
    daily: {
      limit: string;
      spent: string;
      remaining: string;
      percentage: number;
    };
    monthly: {
      limit: string;
      spent: string;
      remaining: string;
      percentage: number;
    };
  };
}

interface EndpointMetrics {
  endpoint: string;
  requestCount: number;
  cacheHitCount: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  totalCost: string;
}

interface CostTimeseriesPoint {
  timestamp: string;
  spent: string;
  saved: string;
  requestCount: number;
}

interface CachePerformance {
  hitCount: number;
  missCount: number;
  hitRate: number;
  totalSavings: string;
  topCachedEndpoints: Array<{
    endpoint: string;
    cacheHits: number;
  }>;
}

// ─── Helpers ─────────────────────────────────────────────

function periodToInterval(period: string): string {
  const map: Record<string, string> = {
    '1h': '1 hour',
    '24h': '24 hours',
    '7d': '7 days',
    '30d': '30 days',
  };
  return map[period] || '7 days';
}

function granularityToTrunc(granularity: string): string {
  const map: Record<string, string> = {
    hourly: 'hour',
    daily: 'day',
    monthly: 'month',
  };
  return map[granularity] || 'day';
}

function calculateRemaining(limit: bigint, spent: bigint): string {
  return String(limit > spent ? limit - spent : BigInt(0));
}

function calculatePercentage(spent: bigint, limit: bigint): number {
  if (limit === BigInt(0)) return 0;
  return Number((spent * BigInt(10000) / limit)) / 100;
}

// ─── Routes ──────────────────────────────────────────────

const analyticsRoutes = new Hono<{ Variables: Variables }>();

/**
 * GET /summary — Overall analytics summary
 * Query params: period (1h, 24h, 7d, 30d; default 7d)
 */
analyticsRoutes.get('/summary', async (c) => {
  try {
    const projectId = c.get('projectId') as string;
    const period = c.req.query('period') || '7d';
    const interval = periodToInterval(period);

    // 1. Get request statistics
    const [stats] = await sql`
      SELECT
        COUNT(*) as total_requests,
        COALESCE(
          SUM(CASE WHEN cached THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0),
          0
        ) as cache_hit_rate,
        COALESCE(AVG(latency_ms), 0) as avg_latency,
        COALESCE(
          SUM(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0),
          0
        ) as success_rate,
        COALESCE(SUM(cost), 0) as total_cost,
        COALESCE(
          SUM(CASE WHEN cached THEN cost ELSE 0 END),
          0
        ) as cache_savings
      FROM requests
      WHERE project_id = ${projectId}::uuid
        AND created_at >= NOW() - ${interval}::interval
    `;

    // 2. Get top 5 endpoints by request count
    const topEndpoints = await sql`
      SELECT endpoint, COUNT(*) as request_count, COALESCE(SUM(cost), 0) as total_cost
      FROM requests
      WHERE project_id = ${projectId}::uuid
        AND created_at >= NOW() - ${interval}::interval
      GROUP BY endpoint
      ORDER BY request_count DESC
      LIMIT 5
    `;

    // 3. Get budget usage from budgets table (limits come from policies)
    const [budget] = await sql`
      SELECT
        b.daily_spent,
        b.monthly_spent,
        p.daily_budget,
        p.monthly_budget
      FROM budgets b
      LEFT JOIN policies p ON p.project_id = b.project_id AND p.is_active = true
      WHERE b.project_id = ${projectId}::uuid
      LIMIT 1
    `;

    // Handle case where budget doesn't exist
    const dailyLimit = budget ? BigInt(budget.daily_budget || '0') : BigInt(0);
    const monthlyLimit = budget ? BigInt(budget.monthly_budget || '0') : BigInt(0);
    const dailySpent = budget ? BigInt(budget.daily_spent) : BigInt(0);
    const monthlySpent = budget ? BigInt(budget.monthly_spent) : BigInt(0);

    const response: SummaryResponse = {
      period,
      totalRequests: Number(stats.total_requests),
      cacheHitRate: Number(stats.cache_hit_rate),
      avgLatency: Number(stats.avg_latency),
      successRate: Number(stats.success_rate),
      totalCost: String(stats.total_cost),
      cacheSavings: String(stats.cache_savings),
      topEndpoints: topEndpoints.map((e) => ({
        endpoint: e.endpoint as string,
        requestCount: Number(e.request_count),
        cost: String(e.total_cost),
      })),
      budgetUsage: {
        daily: {
          limit: String(dailyLimit),
          spent: String(dailySpent),
          remaining: calculateRemaining(dailyLimit, dailySpent),
          percentage: calculatePercentage(dailySpent, dailyLimit),
        },
        monthly: {
          limit: String(monthlyLimit),
          spent: String(monthlySpent),
          remaining: calculateRemaining(monthlyLimit, monthlySpent),
          percentage: calculatePercentage(monthlySpent, monthlyLimit),
        },
      },
    };

    return c.json(response);
  } catch (error) {
    console.error('[Analytics] Error in /summary:', error);
    return c.json(
      {
        error: {
          code: 'ANALYTICS_ERROR',
          message: 'Failed to fetch analytics summary',
        },
      },
      500,
    );
  }
});

/**
 * GET /endpoints — Per-endpoint metrics
 * Query params: period (default 7d), limit (default 20), orderBy (default requestCount)
 */
analyticsRoutes.get('/endpoints', async (c) => {
  try {
    const projectId = c.get('projectId') as string;
    const period = c.req.query('period') || '7d';
    const limit = parseInt(c.req.query('limit') || '20', 10);
    const orderBy = c.req.query('orderBy') || 'requestCount';
    const interval = periodToInterval(period);

    // Map orderBy to SQL column
    const orderByColumn = {
      requestCount: 'request_count',
      avgLatency: 'avg_latency_ms',
      totalCost: 'total_cost',
    }[orderBy] || 'request_count';

    const results = await sql`
      SELECT
        endpoint,
        COUNT(*) as request_count,
        SUM(CASE WHEN cached THEN 1 ELSE 0 END) as cache_hit_count,
        COALESCE(AVG(latency_ms), 0) as avg_latency_ms,
        COALESCE(
          PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms),
          0
        ) as p95_latency_ms,
        COALESCE(SUM(cost), 0) as total_cost
      FROM requests
      WHERE project_id = ${projectId}::uuid
        AND created_at >= NOW() - ${interval}::interval
      GROUP BY endpoint
      ORDER BY ${sql(orderByColumn)} DESC
      LIMIT ${limit}
    `;

    const metrics: EndpointMetrics[] = results.map((r) => ({
      endpoint: r.endpoint as string,
      requestCount: Number(r.request_count),
      cacheHitCount: Number(r.cache_hit_count),
      avgLatencyMs: Number(r.avg_latency_ms),
      p95LatencyMs: Number(r.p95_latency_ms),
      totalCost: String(r.total_cost),
    }));

    return c.json({ endpoints: metrics, total: metrics.length });
  } catch (error) {
    console.error('[Analytics] Error in /endpoints:', error);
    return c.json(
      {
        error: {
          code: 'ANALYTICS_ERROR',
          message: 'Failed to fetch endpoint metrics',
        },
      },
      500,
    );
  }
});

/**
 * GET /costs — Cost time series
 * Query params: period (default 7d), granularity (hourly, daily, monthly; default daily)
 */
analyticsRoutes.get('/costs', async (c) => {
  try {
    const projectId = c.get('projectId') as string;
    const period = c.req.query('period') || '7d';
    const granularity = c.req.query('granularity') || 'daily';
    const interval = periodToInterval(period);
    const truncUnit = granularityToTrunc(granularity);

    const results = await sql.unsafe(`
      SELECT
        DATE_TRUNC($1, created_at) as timestamp,
        COALESCE(SUM(cost), 0) as spent,
        COALESCE(
          SUM(CASE WHEN cached THEN cost ELSE 0 END),
          0
        ) as saved,
        COUNT(*) as request_count
      FROM requests
      WHERE project_id = $2::uuid
        AND created_at >= NOW() - $3::interval
      GROUP BY DATE_TRUNC($1, created_at)
      ORDER BY timestamp ASC
    `, [truncUnit, projectId, interval]);

    const timeseries: CostTimeseriesPoint[] = results.map((r) => ({
      timestamp: (r.timestamp as Date).toISOString(),
      spent: String(r.spent),
      saved: String(r.saved),
      requestCount: Number(r.request_count),
    }));

    // Calculate totals
    const totalSpent = timeseries.reduce((sum, p) => sum + BigInt(p.spent), BigInt(0));
    const totalSaved = timeseries.reduce((sum, p) => sum + BigInt(p.saved), BigInt(0));
    const totalRequests = timeseries.reduce((sum, p) => sum + p.requestCount, 0);

    return c.json({
      timeseries,
      total: {
        spent: String(totalSpent),
        saved: String(totalSaved),
        requests: totalRequests,
      },
    });
  } catch (error) {
    console.error('[Analytics] Error in /costs:', error);
    return c.json(
      {
        error: {
          code: 'ANALYTICS_ERROR',
          message: 'Failed to fetch cost timeseries',
        },
      },
      500,
    );
  }
});

/**
 * GET /cache — Cache performance
 * Query params: period (default 7d)
 */
analyticsRoutes.get('/cache', async (c) => {
  try {
    const projectId = c.get('projectId') as string;
    const period = c.req.query('period') || '7d';
    const interval = periodToInterval(period);

    // 1. Get cache hit/miss statistics
    const [stats] = await sql`
      SELECT
        COALESCE(SUM(CASE WHEN cached THEN 1 ELSE 0 END), 0) as hit_count,
        COALESCE(SUM(CASE WHEN NOT cached THEN 1 ELSE 0 END), 0) as miss_count,
        COALESCE(
          SUM(CASE WHEN cached THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0),
          0
        ) as hit_rate,
        COALESCE(
          SUM(CASE WHEN cached THEN cost ELSE 0 END),
          0
        ) as total_savings
      FROM requests
      WHERE project_id = ${projectId}::uuid
        AND created_at >= NOW() - ${interval}::interval
    `;

    // 2. Get top 10 cached endpoints
    const topCached = await sql`
      SELECT endpoint, COUNT(*) as cache_hits
      FROM requests
      WHERE project_id = ${projectId}::uuid
        AND cached = true
        AND created_at >= NOW() - ${interval}::interval
      GROUP BY endpoint
      ORDER BY cache_hits DESC
      LIMIT 10
    `;

    const response: CachePerformance = {
      hitCount: Number(stats.hit_count),
      missCount: Number(stats.miss_count),
      hitRate: Number(stats.hit_rate),
      totalSavings: String(stats.total_savings),
      topCachedEndpoints: topCached.map((e) => ({
        endpoint: e.endpoint as string,
        cacheHits: Number(e.cache_hits),
      })),
    };

    return c.json(response);
  } catch (error) {
    console.error('[Analytics] Error in /cache:', error);
    return c.json(
      {
        error: {
          code: 'ANALYTICS_ERROR',
          message: 'Failed to fetch cache statistics',
        },
      },
      500,
    );
  }
});

export default analyticsRoutes;
