import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { injectAuthHeaders } from "./auth.js";
import type { ProxyMetadata } from "../proxy-fetch.js";
import { extractProxyMetadata } from "../proxy-fetch.js";

export function registerProxyTools(
  server: McpServer,
  proxyFetch: typeof globalThis.fetch,
  credentials: Record<string, string> = {},
) {
  server.tool(
    "pag0_request",
    [
      "Send an HTTP request through the Pag0 proxy to an x402-enabled API.",
      "Handles payment automatically via the x402 SDK (402 → sign → retry).",
      "Returns the API response along with cost, cache status, and latency metadata.",
    ].join(" "),
    {
      url: z.string().url().describe("Target API URL (e.g. https://x402-ai-starter-alpha.vercel.app/api/add)"),
      method: z.enum(["GET", "POST", "PUT", "DELETE"]).default("GET").describe("HTTP method"),
      headers: z.record(z.string()).optional().describe("Custom headers to forward"),
      body: z.any().optional().describe("Request body (for POST/PUT)"),
    },
    async (args) => {
      const headers = injectAuthHeaders(args.url, args.headers ?? {}, credentials);

      try {
        const response = await proxyFetch(args.url, {
          method: args.method,
          headers: {
            "content-type": "application/json",
            ...headers,
          },
          body: args.body != null ? JSON.stringify(args.body) : undefined,
        });

        const metadata = extractProxyMetadata(response);

        // Try to parse response body
        let body: unknown;
        const ct = response.headers.get("content-type") || "";
        if (ct.includes("application/json")) {
          body = await response.json().catch(() => null);
        } else {
          body = await response.text().catch(() => null);
        }

        if (!response.ok) {
          return {
            content: [{
              type: "text" as const,
              text: `Proxy error (${response.status}): ${JSON.stringify(body, null, 2)}`,
            }],
            isError: true,
          };
        }

        const result: Record<string, unknown> = {
          status: response.status,
          body,
          cost: metadata.cost,
          cached: metadata.cached,
          cacheSource: metadata.cacheSource,
          latency: metadata.latency,
          budgetRemaining: metadata.budgetRemaining,
        };

        if (metadata.cost === "0" && metadata.cacheSource === "passthrough") {
          result.note = "Cost is 0 because the x402 server returned without requiring payment (server-side cache or free response)";
        }

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (err) {
        return {
          content: [{
            type: "text" as const,
            text: `Request failed: ${err instanceof Error ? err.message : String(err)}`,
          }],
          isError: true,
        };
      }
    },
  );
}
