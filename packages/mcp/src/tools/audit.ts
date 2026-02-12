import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Pag0Client } from "../client.js";

/** The Graph subgraph endpoint for ERC-8004 events (fallback: direct RPC) */
const SUBGRAPH_URL =
  process.env.ERC8004_SUBGRAPH_URL || "";

export function registerAuditTools(
  server: McpServer,
  client: Pag0Client,
) {
  // ── pag0_audit_trail ─────────────────────────────────────

  server.tool(
    "pag0_audit_trail",
    "Query on-chain ERC-8004 audit records — payment feedback events with quality scores, IPFS proof URIs, and transaction hashes.",
    {
      endpoint: z.string().optional().describe("Filter by API endpoint hostname"),
      period: z.enum(["today", "week", "month"]).optional().default("week").describe("Time period to query"),
    },
    async (args) => {
      // Try subgraph first, fall back to proxy API
      if (SUBGRAPH_URL) {
        try {
          const data = await querySubgraph(args.endpoint, args.period);
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(data, null, 2),
              },
            ],
          };
        } catch (err) {
          // Fall through to proxy API
          console.error("[audit] Subgraph query failed, falling back to API:", err);
        }
      }

      // Fallback: query via Pag0 proxy reputation API
      if (args.endpoint) {
        const data = await client.getReputationFeedbacks({
          agentId: args.endpoint,
          first: 50,
        }) as {
          data: {
            feedbacks: Array<{
              id: string;
              agentId: string;
              qualityScore: number;
              feedbackURI: string;
              timestamp: string;
              txHash: string;
            }>;
          };
        };
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(data.data?.feedbacks ?? data, null, 2),
            },
          ],
        };
      }

      // No endpoint filter — return leaderboard as overview
      const data = await client.getReputationLeaderboard(50) as {
        data: { agents: unknown[] };
      };
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(data.data?.agents ?? data, null, 2),
          },
        ],
      };
    },
  );

  // ── pag0_reputation ──────────────────────────────────────

  server.tool(
    "pag0_reputation",
    "Get ERC-8004 reputation score for an API endpoint — average quality score, total feedbacks, and recent trend from on-chain data.",
    {
      endpoint: z.string().describe("API endpoint hostname (e.g. api.openai.com)"),
    },
    async (args) => {
      if (SUBGRAPH_URL) {
        try {
          const data = await queryReputation(args.endpoint);
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(data, null, 2),
              },
            ],
          };
        } catch (err) {
          console.error("[audit] Subgraph reputation query failed, falling back:", err);
        }
      }

      // Fallback: query via Pag0 proxy reputation API
      const data = await client.getReputationAgent(args.endpoint) as {
        data: {
          agentId: string;
          avgScore: number;
          feedbackCount: number;
          firstSeen: string;
          lastSeen: string;
        } | null;
      };

      if (!data.data) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                endpoint: args.endpoint,
                avgScore: 0,
                totalFeedbacks: 0,
                recentTrend: "no-data",
              }, null, 2),
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              endpoint: data.data.agentId,
              avgScore: data.data.avgScore,
              totalFeedbacks: data.data.feedbackCount,
              firstSeen: data.data.firstSeen,
              lastSeen: data.data.lastSeen,
            }, null, 2),
          },
        ],
      };
    },
  );
}

// ── Subgraph Query Helpers ──────────────────────────────────

function periodToTimestamp(period: string): number {
  const now = Math.floor(Date.now() / 1000);
  switch (period) {
    case "today":
      return now - 86400;
    case "week":
      return now - 604800;
    case "month":
      return now - 2592000;
    default:
      return now - 604800;
  }
}

async function querySubgraph(
  endpoint: string | undefined,
  period: string,
): Promise<unknown> {
  const since = periodToTimestamp(period);
  const endpointFilter = endpoint
    ? `, agentId_contains: "${endpoint}"`
    : "";

  const query = `{
    feedbackEvents(
      first: 50
      orderBy: timestamp
      orderDirection: desc
      where: { timestamp_gte: "${since}"${endpointFilter} }
    ) {
      id
      agentId
      value
      tag1
      tag2
      feedbackURI
      feedbackHash
      timestamp
      txHash
    }
  }`;

  const res = await fetch(SUBGRAPH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });

  if (!res.ok) throw new Error(`Subgraph ${res.status}`);
  const json = (await res.json()) as { data: { feedbackEvents: unknown[] } };
  return json.data.feedbackEvents;
}

async function queryReputation(endpoint: string): Promise<unknown> {
  const query = `{
    feedbackEvents(
      first: 1000
      where: { agentId_contains: "${endpoint}" }
    ) {
      value
      timestamp
    }
  }`;

  const res = await fetch(SUBGRAPH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });

  if (!res.ok) throw new Error(`Subgraph ${res.status}`);
  const json = (await res.json()) as {
    data: { feedbackEvents: Array<{ value: number; timestamp: string }> };
  };

  const events = json.data.feedbackEvents;
  if (events.length === 0) {
    return {
      endpoint,
      avgScore: 0,
      totalFeedbacks: 0,
      tag: "x402-payment",
      recentTrend: "no-data",
    };
  }

  const total = events.reduce((sum, e) => sum + e.value, 0);
  const avg = Math.round(total / events.length);

  // Recent trend: compare last 10 vs previous 10
  const sorted = [...events].sort(
    (a, b) => Number(b.timestamp) - Number(a.timestamp),
  );
  const recent = sorted.slice(0, 10);
  const previous = sorted.slice(10, 20);
  let trend = "stable";
  if (previous.length > 0) {
    const recentAvg = recent.reduce((s, e) => s + e.value, 0) / recent.length;
    const prevAvg = previous.reduce((s, e) => s + e.value, 0) / previous.length;
    if (recentAvg > prevAvg + 5) trend = "improving";
    else if (recentAvg < prevAvg - 5) trend = "declining";
  }

  return {
    endpoint,
    avgScore: avg,
    totalFeedbacks: events.length,
    tag: "x402-payment",
    recentTrend: trend,
  };
}
