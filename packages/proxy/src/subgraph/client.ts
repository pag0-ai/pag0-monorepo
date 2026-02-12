/**
 * SubgraphClient — GraphQL client for the ERC-8004 subgraph
 *
 * Queries on-chain reputation data indexed by The Graph.
 * All methods return null on failure (graceful degradation).
 * Results are cached in Redis with configurable TTL.
 */

import { createHash } from 'crypto';
import redis from '../cache/redis';
import {
  AGENT_REPUTATION,
  AGENT_PROFILE,
  FEEDBACK_HISTORY,
  LEADERBOARD,
} from './queries';
import type {
  AgentReputation,
  AgentProfile,
  AgentSummary,
  SubgraphFeedbackEvent,
  SubgraphAgent,
} from './types';

const CACHE_TTL = 300; // 5 minutes
const FETCH_TIMEOUT = 3000; // 3s timeout

export class SubgraphClient {
  private url: string | null;
  private enabled: boolean;

  constructor() {
    this.url = process.env.ERC8004_SUBGRAPH_URL || null;
    this.enabled = !!this.url;

    if (this.enabled) {
      console.log(`[Subgraph] Client enabled (url=${this.url})`);
    } else {
      console.log('[Subgraph] Client disabled (ERC8004_SUBGRAPH_URL not set)');
    }
  }

  /**
   * Get aggregated reputation for an agent (avg quality score + count).
   * Looks at feedback events from the last 30 days.
   */
  async getAgentReputation(agentId: string): Promise<AgentReputation | null> {
    if (!this.enabled) return null;

    const since = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000).toString();
    const data = await this.query<{
      feedbackEvents: Array<{ value: number; timestamp: string; txHash: string }>;
    }>(AGENT_REPUTATION, { agentId, since });

    if (!data || data.feedbackEvents.length === 0) return null;

    const events = data.feedbackEvents;
    const avgScore = Math.round(
      events.reduce((sum, e) => sum + e.value, 0) / events.length,
    );

    return {
      avgScore,
      feedbackCount: events.length,
      lastSeen: Number(events[0].timestamp),
    };
  }

  /**
   * Get full agent profile with recent feedbacks.
   */
  async getAgentProfile(agentId: string): Promise<AgentProfile | null> {
    if (!this.enabled) return null;

    const data = await this.query<{
      agent: SubgraphAgent | null;
      feedbackEvents: SubgraphFeedbackEvent[];
    }>(AGENT_PROFILE, { agentId });

    if (!data?.agent) return null;

    return {
      agentId: data.agent.id,
      eventCount: data.agent.eventCount,
      firstSeen: Number(data.agent.firstSeen),
      lastSeen: Number(data.agent.lastSeen),
      recentFeedbacks: data.feedbackEvents,
    };
  }

  /**
   * Get paginated feedback history for an agent.
   */
  async getFeedbackHistory(
    agentId: string,
    first: number = 20,
    skip: number = 0,
  ): Promise<SubgraphFeedbackEvent[]> {
    if (!this.enabled) return [];

    const data = await this.query<{
      feedbackEvents: SubgraphFeedbackEvent[];
    }>(FEEDBACK_HISTORY, { agentId, first, skip });

    return data?.feedbackEvents ?? [];
  }

  /**
   * Get top agents by event count with computed avg scores.
   */
  async getLeaderboard(first: number = 20): Promise<AgentSummary[]> {
    if (!this.enabled) return [];

    const data = await this.query<{
      agents: Array<
        SubgraphAgent & { feedbacks: Array<{ value: number }> }
      >;
    }>(LEADERBOARD, { first });

    if (!data?.agents) return [];

    return data.agents.map((agent) => {
      const avgScore =
        agent.feedbacks.length > 0
          ? Math.round(
              agent.feedbacks.reduce((sum, f) => sum + f.value, 0) /
                agent.feedbacks.length,
            )
          : 0;

      return {
        agentId: agent.id,
        eventCount: agent.eventCount,
        avgScore,
      };
    });
  }

  // ─── Private Helpers ────────────────────────────────────

  /**
   * Execute a GraphQL query with Redis caching and error handling.
   * Returns null on any failure.
   */
  private async query<T>(
    queryStr: string,
    variables: Record<string, unknown>,
  ): Promise<T | null> {
    if (!this.url) return null;

    // Check Redis cache
    const cacheKey = this.cacheKey(queryStr, variables);
    try {
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached) as T;
    } catch {
      // Redis failure — continue without cache
    }

    // Fetch from subgraph
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

      const response = await fetch(this.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: queryStr, variables }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        console.warn(`[Subgraph] HTTP ${response.status}: ${response.statusText}`);
        return null;
      }

      const json = (await response.json()) as { data?: T; errors?: unknown[] };

      if (json.errors) {
        console.warn('[Subgraph] GraphQL errors:', json.errors);
        return null;
      }

      if (!json.data) return null;

      // Cache result
      try {
        await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(json.data));
      } catch {
        // Redis failure — result is still valid
      }

      return json.data;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        console.warn('[Subgraph] Query timed out');
      } else {
        console.warn('[Subgraph] Query failed:', err);
      }
      return null;
    }
  }

  /**
   * Generate a Redis cache key from query + variables.
   */
  private cacheKey(
    queryStr: string,
    variables: Record<string, unknown>,
  ): string {
    const hash = createHash('sha256')
      .update(queryStr + JSON.stringify(variables))
      .digest('hex')
      .slice(0, 16);
    return `subgraph:${hash}`;
  }
}

// Export singleton
export const subgraphClient = new SubgraphClient();
