import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Pag0Client } from "../client.js";
import type { IWallet } from "../wallet.js";
import { createPaymentPayload, type ProxyPaymentInfo } from "../x402-payment.js";

// ── Response text extraction per provider ─────────────────────

function extractResponseText(winner: string, body: unknown): string {
  if (winner === "api.openai.com") {
    const b = body as { choices?: { message?: { content?: string } }[] };
    return b?.choices?.[0]?.message?.content ?? JSON.stringify(body);
  }
  if (winner === "api.anthropic.com") {
    const b = body as { content?: { type?: string; text?: string }[] };
    return b?.content?.[0]?.text ?? JSON.stringify(body);
  }
  return typeof body === "string" ? body : JSON.stringify(body);
}

// ── Registration ───────────────────────────────────────────────

export function registerSmartTools(
  server: McpServer,
  client: Pag0Client,
  wallet: IWallet,
  network: string = "base-sepolia",
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
      try {
        // ── 1. First attempt (no payment) ─────────────────────────
        let response = await client.smartRequest({
          category: args.category,
          prompt: args.prompt,
          maxTokens: args.max_tokens,
          sortBy: args.sort_by,
        });

        let data = await response.json().catch(() => ({})) as any;

        // ── 2. Handle 402 payment required ────────────────────────
        if (response.status === 402 && data.body?.paymentRequest) {
          const paymentInfo = data.body.paymentRequest as ProxyPaymentInfo;

          // Sign payment using wallet
          const signedPayment = await createPaymentPayload(wallet, paymentInfo);

          // Retry with signed payment
          response = await client.smartRequest({
            category: args.category,
            prompt: args.prompt,
            maxTokens: args.max_tokens,
            sortBy: args.sort_by,
            signedPayment,
          });

          data = await response.json().catch(() => ({})) as any;
        }

        // ── 3. Handle errors ──────────────────────────────────────
        if (!response.ok) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Smart request failed (${response.status}): ${JSON.stringify(data, null, 2)}`,
              },
            ],
            isError: true,
          };
        }

        // ── 4. Extract result ─────────────────────────────────────
        const result = data.data;
        if (!result) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Unexpected response format: ${JSON.stringify(data, null, 2)}`,
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  selection: result.selection,
                  response: result.response,
                  metadata: result.metadata,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Smart request failed: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
