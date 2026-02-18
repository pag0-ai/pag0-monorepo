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
import { BscPermit2Scheme } from "./bsc-permit2-scheme.js";

const isVerbose = () => !!process.env.VERBOSE;
function verbose(...args: unknown[]) {
  if (isVerbose()) console.error('[MCP]', ...args);
}

export interface ProxyMetadata {
  cost: string;
  cached: boolean;
  cacheSource: 'proxy_cache' | 'passthrough';
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
  chainId?: number,
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
    if (chainId) headers.set("x-pag0-chain-id", String(chainId));

    // Materialize body as ArrayBuffer to avoid ReadableStream/duplex issues
    let body: BodyInit | null = init?.body ?? null;
    if (!body && req?.body) {
      body = await req.arrayBuffer();
    }

    verbose(`[MCP→Proxy] ${method} ${targetUrl} → relay`);
    const res = await globalThis.fetch(relayUrl, {
      method,
      headers,
      body,
      signal: init?.signal ?? AbortSignal.timeout(RELAY_TIMEOUT_MS),
    });
    verbose(`[MCP←Proxy] ${res.status} ${targetUrl}`);
    return res;
  };

  // Register both V1 and V2 schemes
  const signer = wallet.getEvmSigner();
  const client = new x402Client()
    .registerV1("base-sepolia", new ExactEvmSchemeV1(signer))   // V1 (base-sepolia)
    .registerV1("base", new ExactEvmSchemeV1(signer))           // V1 (base mainnet)
    .register("eip155:84532", new ExactEvmScheme(signer))       // V2 (base-sepolia)
    .register("eip155:8453", new ExactEvmScheme(signer))        // V2 (base mainnet)
    .register("eip155:56", new BscPermit2Scheme(signer));       // BSC Mainnet (custom spender)

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

  const cacheSourceRaw = response.headers.get("x-pag0-cache-source");
  const cacheSource: ProxyMetadata["cacheSource"] =
    cacheSourceRaw === "proxy_cache" ? "proxy_cache" : "passthrough";

  return {
    cost: response.headers.get("x-pag0-cost") || "0",
    cached: response.headers.get("x-pag0-cached") === "true",
    cacheSource,
    latency: Number(response.headers.get("x-pag0-latency") || "0"),
    endpoint: response.headers.get("x-pag0-endpoint") || "",
    budgetRemaining,
  };
}
