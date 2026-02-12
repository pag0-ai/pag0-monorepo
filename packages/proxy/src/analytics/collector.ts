import sql from '../db/postgres';
import redis from '../cache/redis';
import type { UsdcAmount } from '../types';

// ─── Types ───────────────────────────────────────────────

export interface AnalyticsEvent {
  projectId: string;
  endpoint: string;
  method: string;
  statusCode: number;
  latencyMs: number;
  cost: string; // USDC BIGINT
  cached: boolean;
  responseSize: number;
  timestamp?: Date;
  fullUrl?: string;
  policyId?: string;
  cacheKey?: string;
}

export interface AnalyticsSummary {
  totalRequests: number;
  cacheHitRate: number;
  avgLatency: number;
  totalCost: string; // USDC BIGINT
  cacheSavings: string; // USDC BIGINT
}

export interface EndpointStats {
  endpoint: string;
  requestCount: number;
  totalCost: string; // USDC BIGINT
  avgLatency: number;
  cacheHitRate: number;
}

export interface CostTimeseries {
  timestamp: Date;
  spent: string; // USDC BIGINT
  saved: string; // USDC BIGINT
}

export interface CacheStats {
  hitRate: number;
  totalHits: number;
  totalMisses: number;
  bytesSaved: number;
}

export type Period = '1h' | '24h' | '7d' | '30d';
export type Granularity = 'hour' | 'day';

// ─── AnalyticsCollector ──────────────────────────────────

export class AnalyticsCollector {
  /**
   * Record an analytics event — FIRE AND FORGET (async, never blocks)
   * CRITICAL: Must be called with void or .catch() to prevent blocking
   */
  async record(event: AnalyticsEvent): Promise<void> {
    const timestamp = event.timestamp || new Date();
    const fullUrl = event.fullUrl || `https://${event.endpoint}`;

    try {
      // 1. Insert into PostgreSQL requests table (source of truth)
      await sql`
        INSERT INTO requests (
          project_id, endpoint, full_url, method, status_code,
          cost, cached, latency_ms, policy_id, cache_key, created_at
        ) VALUES (
          ${event.projectId}::uuid,
          ${event.endpoint},
          ${fullUrl},
          ${event.method},
          ${event.statusCode},
          ${event.cost}::bigint,
          ${event.cached},
          ${event.latencyMs},
          ${event.policyId || null}::uuid,
          ${event.cacheKey || null},
          ${timestamp}
        )
      `;

      // 2. Update Redis counters via MULTI pipeline (real-time metrics)
      const key = `metrics:${event.projectId}:${event.endpoint}:hourly`;
      await redis
        .multi()
        .hincrby(key, 'count', 1)
        .hincrby(key, 'cache_hits', event.cached ? 1 : 0)
        .hincrby(key, 'cache_misses', event.cached ? 0 : 1)
        .hincrby(key, 'cost', Number(BigInt(event.cost)))
        .hincrby(key, 'latency_sum', event.latencyMs)
        .hincrby(key, 'response_size_sum', event.responseSize)
        .expire(key, 7200) // 2 hours TTL
        .exec();
    } catch (error) {
      // Never throw — analytics errors should not break request flow
      console.error('[AnalyticsCollector] Error recording event:', error);
    }
  }

  /**
   * Get analytics summary for a project over a time period
   */
  async getSummary(
    projectId: string,
    period: Period = '24h',
  ): Promise<AnalyticsSummary> {
    const since = this.getTimestampForPeriod(period);

    const [result] = await sql`
      SELECT
        COUNT(*) as total_requests,
        COALESCE(
          SUM(CASE WHEN cached THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0),
          0
        ) as cache_hit_rate,
        COALESCE(AVG(latency_ms), 0) as avg_latency,
        COALESCE(SUM(cost), 0) as total_cost,
        COALESCE(
          SUM(CASE WHEN cached THEN cost ELSE 0 END),
          0
        ) as cache_savings
      FROM requests
      WHERE project_id = ${projectId}::uuid
        AND created_at >= ${since}
    `;

    return {
      totalRequests: Number(result.total_requests),
      cacheHitRate: Number(result.cache_hit_rate),
      avgLatency: Number(result.avg_latency),
      totalCost: String(result.total_cost),
      cacheSavings: String(result.cache_savings),
    };
  }

  /**
   * Get top endpoints by request count
   */
  async getEndpointStats(
    projectId: string,
    period: Period = '24h',
    limit: number = 10,
  ): Promise<EndpointStats[]> {
    const since = this.getTimestampForPeriod(period);

    const results = await sql`
      SELECT
        endpoint,
        COUNT(*) as request_count,
        COALESCE(SUM(cost), 0) as total_cost,
        COALESCE(AVG(latency_ms), 0) as avg_latency,
        COALESCE(
          SUM(CASE WHEN cached THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0),
          0
        ) as cache_hit_rate
      FROM requests
      WHERE project_id = ${projectId}::uuid
        AND created_at >= ${since}
      GROUP BY endpoint
      ORDER BY request_count DESC
      LIMIT ${limit}
    `;

    return results.map((r) => ({
      endpoint: r.endpoint as string,
      requestCount: Number(r.request_count),
      totalCost: String(r.total_cost),
      avgLatency: Number(r.avg_latency),
      cacheHitRate: Number(r.cache_hit_rate),
    }));
  }

  /**
   * Get cost timeseries data with specified granularity
   */
  async getCostTimeseries(
    projectId: string,
    period: Period = '24h',
    granularity: Granularity = 'hour',
  ): Promise<CostTimeseries[]> {
    const since = this.getTimestampForPeriod(period);
    const truncateUnit = granularity === 'hour' ? 'hour' : 'day';

    const results = await sql`
      SELECT
        DATE_TRUNC(${truncateUnit}, created_at) as timestamp,
        COALESCE(SUM(CASE WHEN NOT cached THEN cost ELSE 0 END), 0) as spent,
        COALESCE(SUM(CASE WHEN cached THEN cost ELSE 0 END), 0) as saved
      FROM requests
      WHERE project_id = ${projectId}::uuid
        AND created_at >= ${since}
      GROUP BY DATE_TRUNC(${truncateUnit}, created_at)
      ORDER BY timestamp ASC
    `;

    return results.map((r) => ({
      timestamp: r.timestamp as Date,
      spent: String(r.spent),
      saved: String(r.saved),
    }));
  }

  /**
   * Get cache performance statistics
   */
  async getCacheStats(
    projectId: string,
    period: Period = '24h',
  ): Promise<CacheStats> {
    const since = this.getTimestampForPeriod(period);

    const [result] = await sql`
      SELECT
        COUNT(*) as total_requests,
        COALESCE(SUM(CASE WHEN cached THEN 1 ELSE 0 END), 0) as total_hits,
        COALESCE(SUM(CASE WHEN NOT cached THEN 1 ELSE 0 END), 0) as total_misses,
        COALESCE(
          SUM(CASE WHEN cached THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0),
          0
        ) as hit_rate,
        COALESCE(
          SUM(CASE WHEN cached THEN cost ELSE 0 END),
          0
        ) as bytes_saved_estimate
      FROM requests
      WHERE project_id = ${projectId}::uuid
        AND created_at >= ${since}
    `;

    return {
      hitRate: Number(result.hit_rate),
      totalHits: Number(result.total_hits),
      totalMisses: Number(result.total_misses),
      bytesSaved: Number(result.bytes_saved_estimate), // Using cost as proxy
    };
  }

  /**
   * Convert period string to timestamp
   */
  private getTimestampForPeriod(period: Period): Date {
    const now = new Date();
    const ms = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
    };

    return new Date(now.getTime() - ms[period]);
  }
}

// Export singleton instance
export const analyticsCollector = new AnalyticsCollector();
