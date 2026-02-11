import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Pag0Client, PaymentRequest } from "../client.js";
import type { Pag0Wallet } from "../wallet.js";

// ── Response types from POST /api/smart-request ───────────────

interface SmartRequestSuccess {
  data: {
    selection: {
      winner: string;
      rationale: string;
      comparison: unknown;
    };
    response: {
      text: string;
      raw: unknown;
    };
    metadata: {
      status: number;
      cost: string;
      cached: boolean;
      latency: number;
      endpoint: string;
      budgetRemaining: { daily: string; monthly: string };
    };
  };
}

interface SmartRequest402 {
  status: 402;
  body: { paymentRequest: PaymentRequest };
  metadata: { endpoint: string; latency: number };
  selection: { winner: string; rationale: string; comparison: unknown };
}

// ── Registration ───────────────────────────────────────────────

export function registerSmartTools(
  server: McpServer,
  client: Pag0Client,
  wallet: Pag0Wallet,
  _credentials: Record<string, string> = {},
) {
  server.tool(
    "pag0_smart_request",
    [
      "Smart Select and Call: automatically picks the best x402 API endpoint in a category using Pag0 curation,",
      "then calls it — all in one step. Internally runs recommend → compare → request.",
      "Returns: selection rationale, API response text, and cost/cache/latency metadata.",
    ].join(" "),
    {
      category: z
        .enum(["AI", "Data", "Blockchain", "IoT", "Finance"])
        .describe("API category to search"),
      prompt: z
        .string()
        .describe("User message to send to the winning provider's chat API"),
      max_tokens: z
        .number()
        .int()
        .positive()
        .default(100)
        .describe("Max tokens for the chat response (default 100)"),
      sort_by: z
        .string()
        .optional()
        .describe(
          "Scoring weight override for recommendations (e.g. 'cost', 'latency', 'reliability')",
        ),
    },
    async (args) => {
      // ── 1. Call the proxy smart-request endpoint ──────────────
      const res = await client.smartRequest({
        category: args.category,
        prompt: args.prompt,
        maxTokens: args.max_tokens,
        sortBy: args.sort_by,
      });

      // ── 2. Success on first try ──────────────────────────────
      if (res.ok) {
        const data = (await res.json()) as SmartRequestSuccess;
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(data.data, null, 2) },
          ],
        };
      }

      // ── 3. 402 Payment Required — sign and retry ─────────────
      if (res.status === 402) {
        const paymentRes = (await res.json()) as SmartRequest402;
        const paymentRequest = paymentRes.body.paymentRequest;

        const signedPayment = await wallet.signPayment({
          id: paymentRequest.id,
          amount: paymentRequest.amount,
          recipient: paymentRequest.recipient,
        });

        // Retry with signed payment
        const retryRes = await client.smartRequest({
          category: args.category,
          prompt: args.prompt,
          maxTokens: args.max_tokens,
          sortBy: args.sort_by,
          signedPayment,
        });

        if (!retryRes.ok) {
          const err = await retryRes
            .json()
            .catch(() => ({ message: retryRes.statusText }));
          return {
            content: [
              {
                type: "text" as const,
                text: `Payment retry failed (${retryRes.status}): ${JSON.stringify(err)}`,
              },
            ],
            isError: true,
          };
        }

        const data = (await retryRes.json()) as SmartRequestSuccess;
        const result = {
          ...data.data,
          metadata: { ...data.data.metadata, paymentId: paymentRequest.id },
        };
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(result, null, 2) },
          ],
        };
      }

      // ── 4. Other errors ──────────────────────────────────────
      const err = await res
        .json()
        .catch(() => ({ message: res.statusText }));
      return {
        content: [
          {
            type: "text" as const,
            text: `Smart request error (${res.status}): ${JSON.stringify(err, null, 2)}`,
          },
        ],
        isError: true,
      };
    },
  );
}
