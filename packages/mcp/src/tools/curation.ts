import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Pag0Client } from "../client.js";

export function registerCurationTools(
  server: McpServer,
  client: Pag0Client,
) {
  // ── Tier 1: pag0_recommend ─────────────────────────────

  server.tool(
    "pag0_recommend",
    "Get recommended APIs ranked by quality score for a given category. Categories: AI Agents, Data & Analytics, IPFS & Storage, Content & Media, Web & Automation, Agent Infrastructure, Crypto & NFT, Developer Tools. Each result includes available API resources with method, path, cost, and schema.",
    {
      category: z.string().describe("API category: AI, Data, Blockchain, IoT, Finance"),
      sort_by: z.string().optional().describe("Sort weight override, e.g. 'cost:0.6,latency:0.2,reliability:0.2'"),
      limit: z.number().optional().default(5).describe("Max results (default 5)"),
    },
    async (args) => {
      const data = await client.getRecommendations({
        category: args.category,
        limit: args.limit,
        sortBy: args.sort_by,
      });
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    },
  );

  // ── Tier 1: pag0_compare ───────────────────────────────

  server.tool(
    "pag0_compare",
    "Compare 2-5 API endpoints side by side. Returns winner per dimension (overall, cost, latency, reliability) with score details and available resources for each endpoint.",
    {
      endpoints: z.array(z.string()).min(2).max(5).describe("Endpoint hostnames to compare, e.g. ['api.openai.com', 'api.anthropic.com']"),
    },
    async (args) => {
      const data = await client.getComparison(args.endpoints);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    },
  );

  // ── Tier 3: pag0_rankings ──────────────────────────────

  server.tool(
    "pag0_rankings",
    "Get global API rankings across all categories or filtered by category. Each ranked endpoint includes available resources with method, path, cost, and schema.",
    {
      category: z.string().optional().describe("Filter by category (optional)"),
      limit: z.number().optional().default(10).describe("Max results"),
    },
    async (args) => {
      const data = await client.getRankings({
        category: args.category,
        limit: args.limit,
      });
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    },
  );

  // ── Tier 3: pag0_score ─────────────────────────────────

  server.tool(
    "pag0_score",
    "Get detailed quality score for a specific API endpoint. Includes available resources (paths, methods, costs, schemas) for the endpoint.",
    {
      endpoint: z.string().describe("Endpoint hostname, e.g. 'api.openai.com'"),
    },
    async (args) => {
      const data = await client.getScore(args.endpoint);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    },
  );
}
