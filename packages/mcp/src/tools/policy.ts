import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Pag0Client } from "../client.js";

export function registerPolicyTools(
  server: McpServer,
  client: Pag0Client,
) {
  // ── Tier 1: pag0_check_budget ──────────────────────────

  server.tool(
    "pag0_check_budget",
    "Check current budget usage — daily and monthly spent vs limits. Use this before expensive API calls to verify budget headroom.",
    {},
    async () => {
      const summary = (await client.getAnalyticsSummary("24h")) as {
        budgetUsage: {
          daily: { limit: string; spent: string; remaining: string; percentage: number };
          monthly: { limit: string; spent: string; remaining: string; percentage: number };
        };
      };

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(summary.budgetUsage, null, 2),
          },
        ],
      };
    },
  );

  // ── Tier 2: pag0_check_policy ──────────────────────────

  server.tool(
    "pag0_check_policy",
    "Check whether a specific API call would be allowed by the active spending policy. Returns allowed/denied with reason.",
    {
      url: z.string().describe("Target API endpoint URL"),
      estimatedCost: z.string().describe("Estimated cost in USDC (6 decimals), e.g. '500000' for 0.5 USDC"),
    },
    async (args) => {
      // Fetch active policies and budget to evaluate locally
      const [policies, summary] = await Promise.all([
        client.getPolicies() as Promise<{
          policies: Array<{
            name: string;
            isActive: boolean;
            maxPerRequest: string;
            dailyBudget: string;
            monthlyBudget: string;
            allowedEndpoints: string[];
            blockedEndpoints?: string[];
          }>;
        }>,
        client.getAnalyticsSummary("24h") as Promise<{
          budgetUsage: {
            daily: { spent: string; remaining: string };
            monthly: { spent: string; remaining: string };
          };
        }>,
      ]);

      const activePolicy = policies.policies.find((p) => p.isActive);
      if (!activePolicy) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ allowed: true, reason: "No active policy" }),
            },
          ],
        };
      }

      const cost = BigInt(args.estimatedCost);
      const maxPerRequest = BigInt(activePolicy.maxPerRequest);
      const dailyRemaining = BigInt(summary.budgetUsage.daily.remaining);
      const monthlyRemaining = BigInt(summary.budgetUsage.monthly.remaining);

      // Check blocked endpoints
      const hostname = new URL(args.url).hostname;
      if (activePolicy.blockedEndpoints?.some((b) => hostname.includes(b))) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                allowed: false,
                reason: "ENDPOINT_BLOCKED",
                policyName: activePolicy.name,
              }),
            },
          ],
        };
      }

      // Check per-request limit
      if (cost > maxPerRequest) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                allowed: false,
                reason: "PER_REQUEST_LIMIT_EXCEEDED",
                policyName: activePolicy.name,
                maxPerRequest: activePolicy.maxPerRequest,
              }),
            },
          ],
        };
      }

      // Check daily budget
      if (cost > dailyRemaining) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                allowed: false,
                reason: "DAILY_BUDGET_EXCEEDED",
                policyName: activePolicy.name,
                dailyRemaining: dailyRemaining.toString(),
              }),
            },
          ],
        };
      }

      // Check monthly budget
      if (cost > monthlyRemaining) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                allowed: false,
                reason: "MONTHLY_BUDGET_EXCEEDED",
                policyName: activePolicy.name,
                monthlyRemaining: monthlyRemaining.toString(),
              }),
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              allowed: true,
              reason: "Within all policy limits",
              policyName: activePolicy.name,
            }),
          },
        ],
      };
    },
  );

  // ── Tier 2: pag0_list_policies ─────────────────────────

  server.tool(
    "pag0_list_policies",
    "List all spending policies for the current project.",
    {},
    async () => {
      const data = await client.getPolicies();
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
