import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Pag0Client, PaymentRequest, ProxyResponse } from "../client.js";
import type { Pag0Wallet } from "../wallet.js";
import { injectAuthHeaders } from "./auth.js";

export function registerProxyTools(
  server: McpServer,
  client: Pag0Client,
  wallet: Pag0Wallet,
  credentials: Record<string, string> = {},
) {
  server.tool(
    "pag0_request",
    [
      "Send an HTTP request through the Pag0 proxy to an x402-enabled API.",
      "Handles payment automatically: if the server returns 402, signs the payment with the agent wallet and retries.",
      "Returns the API response along with cost, cache status, and latency metadata.",
    ].join(" "),
    {
      url: z.string().url().describe("Target API URL (e.g. https://api.openai.com/v1/models)"),
      method: z.enum(["GET", "POST", "PUT", "DELETE"]).default("GET").describe("HTTP method"),
      headers: z.record(z.string()).optional().describe("Custom headers to forward"),
      body: z.any().optional().describe("Request body (for POST/PUT)"),
    },
    async (args) => {
      const headers = injectAuthHeaders(args.url, args.headers ?? {}, credentials);

      // 1) First attempt — may return 402
      const res = await client.proxyRequest({
        targetUrl: args.url,
        method: args.method,
        headers,
        body: args.body,
      });

      // 2) Success on first try (cache hit or free endpoint)
      if (res.status === 200) {
        const data = (await res.json()) as ProxyResponse;
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  status: data.status,
                  body: data.body,
                  cost: data.metadata.cost,
                  cached: data.metadata.cached,
                  latency: data.metadata.latency,
                  budgetRemaining: data.metadata.budgetRemaining,
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      // 3) 402 Payment Required — sign and retry
      if (res.status === 402) {
        const paymentRes = await res.json() as {
          body: { paymentRequest: PaymentRequest };
          metadata: { cost: string; endpoint: string };
        };

        const paymentRequest = paymentRes.body.paymentRequest;

        // Sign payment with agent wallet
        const signedPayment = await wallet.signPayment({
          id: paymentRequest.id,
          amount: paymentRequest.amount,
          recipient: paymentRequest.recipient,
        });

        // Retry with signed payment
        const retryRes = await client.proxyRequest({
          targetUrl: args.url,
          method: args.method,
          headers,
          body: args.body,
          signedPayment,
        });

        if (!retryRes.ok) {
          const err = await retryRes.json().catch(() => ({
            message: retryRes.statusText,
          }));
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

        const data = (await retryRes.json()) as ProxyResponse;
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  status: data.status,
                  body: data.body,
                  cost: data.metadata.cost,
                  cached: data.metadata.cached,
                  latency: data.metadata.latency,
                  budgetRemaining: data.metadata.budgetRemaining,
                  paymentId: paymentRequest.id,
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      // 4) Other errors (403 policy violation, 429 rate limit, etc.)
      const err = await res.json().catch(() => ({
        message: res.statusText,
      }));
      return {
        content: [
          {
            type: "text" as const,
            text: `Proxy error (${res.status}): ${JSON.stringify(err, null, 2)}`,
          },
        ],
        isError: true,
      };
    },
  );
}
