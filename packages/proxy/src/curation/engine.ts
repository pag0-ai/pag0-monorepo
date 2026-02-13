import sql from '../db/postgres';
import redis from '../cache/redis';
import { subgraphClient } from '../subgraph/client';
import type { EndpointScore, EndpointResource } from '../types';

/**
 * CurationEngine — Endpoint scoring, recommendation, and comparison
 *
 * Scoring algorithm from 03-TECH-SPEC.md section 2.5.2:
 * - Cost Score: lower is better (0-100)
 * - Latency Score: lower is better (0-100)
 * - Reliability Score: higher is better (0-100)
 * - Overall Score: weighted sum (default: cost*0.4 + latency*0.3 + reliability*0.3)
 */

interface ScoreWeights {
  cost: number;
  latency: number;
  reliability: number;
  reputation: number;
}

interface Benchmarks {
  avgCost: number;
  avgP95Latency: number;
}

interface CompareResult {
  endpoints: EndpointScore[];
  winner: {
    overall: string;
    cost: string;
    latency: string;
    reliability: string;
  };
  differences: {
    costRange: { min: number; max: number; delta: number };
    latencyRange: { min: number; max: number; delta: number };
    reliabilityRange: { min: number; max: number; delta: number };
  };
}

const DEFAULT_WEIGHTS: ScoreWeights = {
  cost: 0.3,
  latency: 0.25,
  reliability: 0.25,
  reputation: 0.2,
};

export class CurationEngine {
  private parseResources(raw: any): EndpointResource[] {
    if (!raw) return [];
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : [];
  }

  /**
   * Calculate cost score (0-100)
   * Lower cost = higher score
   */
  private scoreCost(avgCost: number, benchmarkCost: number): number {
    if (benchmarkCost === 0) return 50; // Default if no benchmark
    const ratio = avgCost / benchmarkCost;
    if (ratio >= 2) return 0;
    if (ratio <= 0.5) return 100;
    return 100 * (1 - (ratio - 0.5) / 1.5);
  }

  /**
   * Calculate latency score (0-100)
   * Lower latency = higher score
   */
  private scoreLatency(p95Latency: number, benchmarkLatency: number): number {
    if (benchmarkLatency === 0) return 50; // Default if no benchmark
    const ratio = p95Latency / benchmarkLatency;
    if (ratio >= 2) return 0;
    if (ratio <= 0.5) return 100;
    return 100 * (1 - (ratio - 0.5) / 1.5);
  }

  /**
   * Calculate reliability score (0-100)
   * Higher success rate = higher score
   */
  private scoreReliability(successRate: number): number {
    return Math.min(100, successRate * 100);
  }

  /**
   * Calculate overall score (weighted average)
   */
  private calculateOverallScore(
    costScore: number,
    latencyScore: number,
    reliabilityScore: number,
    reputationScore: number = 50,
    weights: ScoreWeights = DEFAULT_WEIGHTS,
  ): number {
    return Math.round(
      costScore * weights.cost +
        latencyScore * weights.latency +
        reliabilityScore * weights.reliability +
        reputationScore * weights.reputation,
    );
  }

  /**
   * Get category benchmarks (average cost and latency)
   */
  private async getBenchmarks(category: string): Promise<Benchmarks> {
    const [result] = await sql<
      Array<{ avg_cost: string | null; avg_latency: string | null }>
    >`
      SELECT
        AVG((evidence->>'avgCostPerRequest')::bigint) as avg_cost,
        AVG((evidence->>'avgLatencyMs')::numeric) as avg_latency
      FROM endpoint_scores
      WHERE category = ${category}
    `;

    return {
      avgCost: result?.avg_cost ? Number(result.avg_cost) : 500000, // Default 0.5 USDC
      avgP95Latency: result?.avg_latency ? Number(result.avg_latency) : 200, // Default 200ms
    };
  }

  /**
   * Calculate score for an endpoint based on 30-day metrics
   */
  async calculateScore(
    endpoint: string,
    category: string,
  ): Promise<EndpointScore> {
    // Get 30-day metrics from requests table
    const [metrics] = await sql<
      Array<{
        request_count: number;
        avg_cost: string | null;
        p95_latency: string | null;
        success_rate: string | null;
      }>
    >`
      SELECT
        COUNT(*) as request_count,
        AVG(cost::bigint) as avg_cost,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) as p95_latency,
        SUM(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 ELSE 0 END)::float / COUNT(*) as success_rate
      FROM requests
      WHERE endpoint = ${endpoint}
        AND created_at >= NOW() - INTERVAL '30 days'
    `;

    // Fetch on-chain reputation (non-blocking, returns null if unavailable)
    const onChainRep = await subgraphClient.getAgentReputation(endpoint).catch(() => null);
    const reputationScore = onChainRep?.avgScore ?? 50;

    // If no off-chain data, use on-chain score if available
    if (!metrics || Number(metrics.request_count) < 1) {
      const defaultScore = onChainRep ? reputationScore : 50;
      return {
        endpoint,
        category,
        overallScore: defaultScore,
        costScore: 50,
        latencyScore: 50,
        reliabilityScore: 50,
        reputationScore,
        sampleSize: Number(metrics?.request_count || 0),
        lastCalculated: new Date(),
        weights: { ...DEFAULT_WEIGHTS },
        evidence: {
          sampleSize: Number(metrics?.request_count || 0),
          period: '30d',
          avgCostPerRequest: '0',
          avgLatencyMs: 0,
          successRate: 0,
        },
      };
    }

    // Get category benchmarks
    const benchmarks = await this.getBenchmarks(category);

    // Calculate individual scores
    const avgCost = Number(metrics.avg_cost || 0);
    const p95Latency = Number(metrics.p95_latency || 0);
    const successRate = Number(metrics.success_rate || 0);

    const costScore = this.scoreCost(avgCost, benchmarks.avgCost);
    const latencyScore = this.scoreLatency(p95Latency, benchmarks.avgP95Latency);
    const reliabilityScore = this.scoreReliability(successRate);
    const overallScore = this.calculateOverallScore(
      costScore,
      latencyScore,
      reliabilityScore,
      reputationScore,
    );

    return {
      endpoint,
      category,
      overallScore,
      costScore,
      latencyScore,
      reliabilityScore,
      reputationScore,
      sampleSize: Number(metrics.request_count),
      lastCalculated: new Date(),
      weights: { ...DEFAULT_WEIGHTS },
      evidence: {
        sampleSize: Number(metrics.request_count),
        period: '30d',
        avgCostPerRequest: String(Math.round(avgCost)),
        avgLatencyMs: Math.round(p95Latency),
        successRate: Number(successRate.toFixed(4)),
      },
    };
  }

  /**
   * Recalculate score from requests table and upsert into endpoint_scores.
   * Called fire-and-forget after each analytics record.
   */
  async refreshScore(endpoint: string): Promise<void> {
    // Look up existing category + evidence from endpoint_scores (seed or previous)
    const [existing] = await sql<Array<{ category: string; evidence: { sampleSize: number; baseSampleSize?: number } }>>`
      SELECT category, evidence FROM endpoint_scores WHERE endpoint = ${endpoint}
    `;
    const category = existing?.category || 'Uncategorized';

    const score = await this.calculateScore(endpoint, category);
    if (score.sampleSize < 1) return;

    // Merge sampleSize: preserve seed base + add real request count
    // baseSampleSize tracks the original seed value so we don't double-count
    // Note: postgres+bun returns JSONB as string, so parse if needed
    const existingEvidence = typeof existing?.evidence === 'string'
      ? JSON.parse(existing.evidence)
      : existing?.evidence;
    const baseSampleSize = existingEvidence?.baseSampleSize ?? existingEvidence?.sampleSize ?? 0;
    const mergedEvidence = {
      ...score.evidence,
      sampleSize: baseSampleSize + (score.evidence?.sampleSize ?? score.sampleSize),
      baseSampleSize,
    };

    // Upsert into endpoint_scores
    await sql`
      INSERT INTO endpoint_scores (endpoint, category, overall_score, cost_score, latency_score, reliability_score, weights, evidence)
      VALUES (
        ${endpoint}, ${category},
        ${score.overallScore}, ${score.costScore}, ${score.latencyScore}, ${score.reliabilityScore},
        ${JSON.stringify(score.weights)}, ${JSON.stringify(mergedEvidence)}
      )
      ON CONFLICT (endpoint) DO UPDATE SET
        overall_score = EXCLUDED.overall_score,
        cost_score = EXCLUDED.cost_score,
        latency_score = EXCLUDED.latency_score,
        reliability_score = EXCLUDED.reliability_score,
        weights = EXCLUDED.weights,
        evidence = EXCLUDED.evidence,
        updated_at = NOW()
    `;

    // Invalidate Redis score cache so getScore() returns fresh data
    await redis.del(`score:${endpoint}`);
  }

  /**
   * Get score for an endpoint (Redis cache first, then DB)
   */
  async getScore(endpoint: string): Promise<EndpointScore | null> {
    const cacheKey = `score:${endpoint}`;

    // Try Redis cache first
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Query from DB
    const [score] = await sql<
      Array<{
        endpoint: string;
        category: string;
        overall_score: string;
        cost_score: string;
        latency_score: string;
        reliability_score: string;
        weights: { cost: number; latency: number; reliability: number; reputation?: number };
        evidence: {
          sampleSize: number;
          period: string;
          avgCostPerRequest: string;
          avgLatencyMs: number;
          successRate: number;
        };
        resources: any;
        updated_at: Date;
      }>
    >`
      SELECT
        endpoint,
        category,
        overall_score,
        cost_score,
        latency_score,
        reliability_score,
        weights,
        evidence,
        resources,
        updated_at
      FROM endpoint_scores
      WHERE endpoint = ${endpoint}
    `;

    if (!score) {
      return null;
    }

    const result: EndpointScore = {
      endpoint: score.endpoint,
      category: score.category,
      overallScore: Number(score.overall_score),
      costScore: Number(score.cost_score),
      latencyScore: Number(score.latency_score),
      reliabilityScore: Number(score.reliability_score),
      sampleSize: score.evidence.sampleSize,
      lastCalculated: new Date(score.updated_at),
      weights: {
        cost: score.weights.cost,
        latency: score.weights.latency,
        reliability: score.weights.reliability,
        reputation: score.weights.reputation ?? DEFAULT_WEIGHTS.reputation,
      },
      evidence: score.evidence,
      resources: this.parseResources(score.resources),
    };

    // Cache in Redis (TTL: 300s)
    await redis.setex(cacheKey, 300, JSON.stringify(result));

    return result;
  }

  /**
   * Get recommendations by category
   */
  async getRecommendations(
    category?: string,
    limit: number = 5,
    sortBy: 'overall' | 'cost' | 'latency' | 'reliability' = 'overall',
  ): Promise<EndpointScore[]> {
    const sortColumn =
      sortBy === 'overall'
        ? 'overall_score'
        : sortBy === 'cost'
          ? 'cost_score'
          : sortBy === 'latency'
            ? 'latency_score'
            : 'reliability_score';

    type ScoreRow = {
      endpoint: string;
      category: string;
      overall_score: string;
      cost_score: string;
      latency_score: string;
      reliability_score: string;
      weights: { cost: number; latency: number; reliability: number; reputation?: number };
      evidence: {
        sampleSize: number;
        period: string;
        avgCostPerRequest: string;
        avgLatencyMs: number;
        successRate: number;
      };
      resources: any;
      updated_at: Date;
    };

    const scores = category
      ? await sql<Array<ScoreRow>>`
          SELECT endpoint, category, overall_score, cost_score, latency_score, reliability_score,
            weights, evidence, resources, updated_at
          FROM endpoint_scores
          WHERE category = ${category}
          ORDER BY ${sql(sortColumn)} DESC
          LIMIT ${limit}
        `
      : await sql<Array<ScoreRow>>`
          SELECT endpoint, category, overall_score, cost_score, latency_score, reliability_score,
            weights, evidence, resources, updated_at
          FROM endpoint_scores
          ORDER BY ${sql(sortColumn)} DESC
          LIMIT ${limit}
        `;

    return scores.map((score) => ({
      endpoint: score.endpoint,
      category: score.category,
      overallScore: Number(score.overall_score),
      costScore: Number(score.cost_score),
      latencyScore: Number(score.latency_score),
      reliabilityScore: Number(score.reliability_score),
      sampleSize: score.evidence.sampleSize,
      lastCalculated: new Date(score.updated_at),
      weights: {
        cost: score.weights.cost,
        latency: score.weights.latency,
        reliability: score.weights.reliability,
        reputation: score.weights.reputation ?? DEFAULT_WEIGHTS.reputation,
      },
      evidence: score.evidence,
      resources: this.parseResources(score.resources),
    }));
  }

  /**
   * Compare 2-5 endpoints side-by-side
   */
  async compareEndpoints(endpoints: string[]): Promise<CompareResult> {
    if (endpoints.length < 2 || endpoints.length > 5) {
      throw new Error('Must compare between 2-5 endpoints');
    }

    const scores = await sql<
      Array<{
        endpoint: string;
        category: string;
        overall_score: string;
        cost_score: string;
        latency_score: string;
        reliability_score: string;
        weights: { cost: number; latency: number; reliability: number; reputation?: number };
        evidence: {
          sampleSize: number;
          period: string;
          avgCostPerRequest: string;
          avgLatencyMs: number;
          successRate: number;
        };
        resources: any;
        updated_at: Date;
      }>
    >`
      SELECT
        endpoint,
        category,
        overall_score,
        cost_score,
        latency_score,
        reliability_score,
        weights,
        evidence,
        resources,
        updated_at
      FROM endpoint_scores
      WHERE endpoint = ANY(${endpoints})
    `;

    if (scores.length === 0) {
      throw new Error('No scores found for specified endpoints');
    }

    const endpointScores: EndpointScore[] = scores.map((score) => ({
      endpoint: score.endpoint,
      category: score.category,
      overallScore: Number(score.overall_score),
      costScore: Number(score.cost_score),
      latencyScore: Number(score.latency_score),
      reliabilityScore: Number(score.reliability_score),
      sampleSize: score.evidence.sampleSize,
      lastCalculated: new Date(score.updated_at),
      weights: {
        cost: score.weights.cost,
        latency: score.weights.latency,
        reliability: score.weights.reliability,
        reputation: score.weights.reputation ?? DEFAULT_WEIGHTS.reputation,
      },
      evidence: score.evidence,
      resources: this.parseResources(score.resources),
    }));

    // Find winners in each dimension
    const overallWinner = endpointScores.reduce((best, curr) =>
      curr.overallScore > best.overallScore ? curr : best,
    );
    const costWinner = endpointScores.reduce((best, curr) =>
      curr.costScore > best.costScore ? curr : best,
    );
    const latencyWinner = endpointScores.reduce((best, curr) =>
      curr.latencyScore > best.latencyScore ? curr : best,
    );
    const reliabilityWinner = endpointScores.reduce((best, curr) =>
      curr.reliabilityScore > best.reliabilityScore ? curr : best,
    );

    // Calculate differences (ranges and deltas)
    const costScores = endpointScores.map((s) => s.costScore);
    const latencyScores = endpointScores.map((s) => s.latencyScore);
    const reliabilityScores = endpointScores.map((s) => s.reliabilityScore);

    const costMin = Math.min(...costScores);
    const costMax = Math.max(...costScores);
    const latencyMin = Math.min(...latencyScores);
    const latencyMax = Math.max(...latencyScores);
    const reliabilityMin = Math.min(...reliabilityScores);
    const reliabilityMax = Math.max(...reliabilityScores);

    return {
      endpoints: endpointScores,
      winner: {
        overall: overallWinner.endpoint,
        cost: costWinner.endpoint,
        latency: latencyWinner.endpoint,
        reliability: reliabilityWinner.endpoint,
      },
      differences: {
        costRange: { min: costMin, max: costMax, delta: costMax - costMin },
        latencyRange: { min: latencyMin, max: latencyMax, delta: latencyMax - latencyMin },
        reliabilityRange: { min: reliabilityMin, max: reliabilityMax, delta: reliabilityMax - reliabilityMin },
      },
    };
  }

  /**
   * Get rankings by category
   */
  async getRankings(
    category?: string,
    limit: number = 20,
  ): Promise<EndpointScore[]> {
    type RankingRow = {
      endpoint: string;
      category: string;
      overall_score: string;
      cost_score: string;
      latency_score: string;
      reliability_score: string;
      weights: { cost: number; latency: number; reliability: number; reputation?: number };
      evidence: {
        sampleSize: number;
        period: string;
        avgCostPerRequest: string;
        avgLatencyMs: number;
        successRate: number;
      };
      resources: any;
      updated_at: Date;
    };

    const query = category
      ? sql<Array<RankingRow>>`
          SELECT
            endpoint, category, overall_score, cost_score, latency_score, reliability_score,
            weights, evidence, resources, updated_at
          FROM endpoint_scores
          WHERE category = ${category}
          ORDER BY overall_score DESC
          LIMIT ${limit}
        `
      : sql<Array<RankingRow>>`
          SELECT
            endpoint, category, overall_score, cost_score, latency_score, reliability_score,
            weights, evidence, resources, updated_at
          FROM endpoint_scores
          ORDER BY overall_score DESC
          LIMIT ${limit}
        `;

    const scores = await query;

    return scores.map((score) => ({
      endpoint: score.endpoint,
      category: score.category,
      overallScore: Number(score.overall_score),
      costScore: Number(score.cost_score),
      latencyScore: Number(score.latency_score),
      reliabilityScore: Number(score.reliability_score),
      sampleSize: score.evidence.sampleSize,
      lastCalculated: new Date(score.updated_at),
      weights: {
        cost: score.weights.cost,
        latency: score.weights.latency,
        reliability: score.weights.reliability,
        reputation: score.weights.reputation ?? DEFAULT_WEIGHTS.reputation,
      },
      evidence: score.evidence,
      resources: this.parseResources(score.resources),
    }));
  }
}

// Export singleton instance
export const curationEngine = new CurationEngine();
