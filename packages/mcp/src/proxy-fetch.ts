/**
 * Proxy-aware fetch wrapper using @x402/fetch SDK.
 *
 * Creates a fetch function that routes through the Pag0 /relay endpoint
 * and lets the x402 SDK handle the 402 → sign → retry flow automatically.
 *
 * Usage:
 *   const pf = createProxyFetch(proxyUrl, apiKey, wallet);
 *   const res = await pf("https://x402-api.example.com/endpoint", { method: "POST", body: ... });
 *   const meta = extractProxyMetadata(res);
 */

import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { ExactEvmSchemeV1 } from "@x402/evm/v1";
import type { IWallet } from "./wallet.js";

export interface ProxyMetadata {
  cost: string;
  cached: boolean;
  latency: number;
  endpoint: string;
  budgetRemaining?: { daily: string; monthly: string };
}

const RELAY_TIMEOUT_MS = 20_000; // 20s client-side timeout (> proxy's 15s upstream timeout)

/**
 * Create a fetch function that routes through the Pag0 /relay endpoint
 * with automatic x402 payment handling.
 */
export function createProxyFetch(
  proxyBaseUrl: string,
  apiKey: string,
  wallet: IWallet,
): typeof globalThis.fetch {
  const relayUrl = proxyBaseUrl.replace(/\/$/, "") + "/relay";

  // Build a relay-aware fetch that rewrites URLs to the proxy.
  // x402 SDK calls fetch(Request) with a Request object (no init),
  // so we must extract method/headers/body from the Request when init is absent.
  const relayFetch: typeof globalThis.fetch = async (input, init?) => {
    const req = (typeof input !== "string" && !(input instanceof URL))
      ? input as Request
      : null;

    const targetUrl = typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;

    const method = init?.method ?? req?.method ?? "GET";
    const headers = new Headers(init?.headers ?? req?.headers);
    headers.set("x-pag0-target-url", targetUrl);
    headers.set("x-pag0-api-key", apiKey);

    // Materialize body as ArrayBuffer to avoid ReadableStream/duplex issues
    let body: BodyInit | null = init?.body ?? null;
    if (!body && req?.body) {
      body = await req.arrayBuffer();
    }

    return globalThis.fetch(relayUrl, {
      method,
      headers,
      body,
      signal: init?.signal ?? AbortSignal.timeout(RELAY_TIMEOUT_MS),
    });
  };

  // Register both V1 and V2 schemes
  const signer = wallet.getEvmSigner();
  const client = new x402Client()
    .registerV1("base-sepolia", new ExactEvmSchemeV1(signer))   // V1 (base-sepolia)
    .registerV1("base", new ExactEvmSchemeV1(signer))           // V1 (base mainnet)
    .register("eip155:84532", new ExactEvmScheme(signer))       // V2 (base-sepolia)
    .register("eip155:8453", new ExactEvmScheme(signer));        // V2 (base mainnet)

  return wrapFetchWithPayment(relayFetch, client);
}

/**
 * Extract Pag0 metadata from X-Pag0-* response headers.
 */
export function extractProxyMetadata(response: Response): ProxyMetadata {
  const budgetRaw = response.headers.get("x-pag0-budget-remaining");
  let budgetRemaining: { daily: string; monthly: string } | undefined;
  if (budgetRaw) {
    try { budgetRemaining = JSON.parse(budgetRaw); } catch { /* ignore */ }
  }

  return {
    cost: response.headers.get("x-pag0-cost") || "0",
    cached: response.headers.get("x-pag0-cached") === "true",
    latency: Number(response.headers.get("x-pag0-latency") || "0"),
    endpoint: response.headers.get("x-pag0-endpoint") || "",
    budgetRemaining,
  };
}
