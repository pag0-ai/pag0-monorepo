import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Pag0Client } from "../client.js";
import type { IWallet } from "../wallet.js";
import {
  createPaymentPayload,
  type ProxyPaymentInfo,
} from "../x402-payment.js";

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
  body: { paymentRequest: ProxyPaymentInfo };
  metadata: { endpoint: string; latency: number };
  selection: { winner: string; rationale: string; comparison: unknown };
}

// ── Registration ───────────────────────────────────────────────

export function registerSmartTools(
  server: McpServer,
  client: Pag0Client,
  wallet: IWallet,
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
        .enum([
          "AI Agents",
          "Data & Analytics",
          "IPFS & Storage",
          "Content & Media",
          "Web & Automation",
          "Agent Infrastructure",
          "Crypto & NFT",
          "Developer Tools",
        ])
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

      // ── 3. 402 Payment Required — sign and retry through proxy
      if (res.status === 402) {
        const paymentRes = (await res.json()) as SmartRequest402;
        const paymentInfo = paymentRes.body.paymentRequest;

        if (!paymentInfo?.payTo || !paymentInfo?.asset || !paymentInfo?.extra) {
          return {
            content: [
              {
                type: "text" as const,
                text: `402 received but payment info incomplete. Selection: ${paymentRes.selection?.winner}. Info: ${JSON.stringify(paymentInfo)}`,
              },
            ],
            isError: true,
          };
        }

        // Create x402 PaymentPayload (EIP-3009 transferWithAuthorization)
        const signedPayment = await createPaymentPayload(wallet, paymentInfo);

        // Retry through proxy with signed payment
        const retryRes = await client.smartRequest({
          category: args.category,
          prompt: args.prompt,
          maxTokens: args.max_tokens,
          sortBy: args.sort_by,
          signedPayment,
        });

        if (retryRes.ok) {
          const data = (await retryRes.json()) as SmartRequestSuccess;
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    ...data.data,
                    payment: { success: true, note: "paid via x402 through proxy" },
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        const err = await retryRes.text().catch(() => retryRes.statusText);
        return {
          content: [
            {
              type: "text" as const,
              text: `x402 payment retry failed (${retryRes.status}): ${err}`,
            },
          ],
          isError: true,
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
