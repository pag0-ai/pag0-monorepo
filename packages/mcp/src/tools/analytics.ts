import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Pag0Client } from "../client.js";

export function registerAnalyticsTools(
  server: McpServer,
  client: Pag0Client,
) {
  // ── Tier 2: pag0_spending ──────────────────────────────

  server.tool(
    "pag0_spending",
    "Get spending summary — total spent, total saved by cache, request count, and cache hit rate for a given period.",
    {
      period: z.enum(["1h", "24h", "7d", "30d"]).optional().default("24h").describe("Time period"),
    },
    async (args) => {
      const data = (await client.getAnalyticsSummary(args.period)) as {
        totalRequests: number;
        cacheHitRate: number;
        totalCost: string;
        cacheSavings: string;
        successRate: number;
        avgLatency: number;
      };

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                totalSpent: data.totalCost,
                totalSaved: data.cacheSavings,
                requestCount: data.totalRequests,
                cacheHitRate: data.cacheHitRate,
                successRate: data.successRate,
                avgLatency: data.avgLatency,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // ── Tier 2: pag0_cache_stats ───────────────────────────

  server.tool(
    "pag0_cache_stats",
    "Get cache performance stats — hit rate, hit/miss counts, and total savings from caching.",
    {},
    async () => {
      const data = (await client.getAnalyticsCache()) as {
        hitRate: number;
        hitCount: number;
        missCount: number;
        totalSavings: string;
        topCachedEndpoints: Array<{
          endpoint: string;
          hitRate: number;
          savings: string;
        }>;
      };

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                hitRate: data.hitRate,
                hitCount: data.hitCount,
                missCount: data.missCount,
                savedAmount: data.totalSavings,
                topCachedEndpoints: data.topCachedEndpoints,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // ── Tier 2: pag0_tx_history ────────────────────────────

  server.tool(
    "pag0_tx_history",
    "Get recent transaction history — endpoint, cost, cache status, and timestamp for each request.",
    {
      limit: z.number().optional().default(10).describe("Number of recent transactions to return"),
    },
    async (args) => {
      const data = (await client.getAnalyticsEndpoints({
        period: "24h",
        limit: args.limit,
        orderBy: "requestCount",
      })) as {
        endpoints: Array<{
          endpoint: string;
          requestCount: number;
          totalSpent: string;
          cacheHitRate: number;
          avgLatencyMs: number;
        }>;
      };

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(data.endpoints, null, 2),
          },
        ],
      };
    },
  );
}
