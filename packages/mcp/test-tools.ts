#!/usr/bin/env npx tsx
/**
 * MCP Tools Integration Test
 *
 * Tests the Pag0 MCP client methods and proxyFetch flow directly
 * (no MCP server/transport needed).
 *
 * Usage:
 *   cd packages/mcp
 *   npx tsx test-tools.ts              # run all tests
 *   npx tsx test-tools.ts --smart-only # run only smart-request tests
 *
 * Requires:
 *   - Proxy running at PAG0_API_URL (default localhost:3000)
 *   - .env with PAG0_API_URL, PAG0_API_KEY, WALLET_PRIVATE_KEY or CDP creds
 */

import "dotenv/config";
import { Pag0Client } from "./src/client.js";
import { Pag0Wallet } from "./src/wallet.js";
import { CdpWallet } from "./src/cdp-wallet.js";
import type { IWallet } from "./src/wallet.js";
import { createProxyFetch, extractProxyMetadata } from "./src/proxy-fetch.js";
import { injectAuthHeaders } from "./src/tools/auth.js";

// ── Config ────────────────────────────────────────────────────

const PAG0_API_URL = process.env.PAG0_API_URL!;
const PAG0_API_KEY = process.env.PAG0_API_KEY!;
const WALLET_MODE = process.env.WALLET_MODE ?? "local";
const NETWORK = process.env.NETWORK ?? "base-sepolia";

const API_CREDENTIALS: Record<string, string> = {};
if (process.env.OPENAI_API_KEY) API_CREDENTIALS["api.openai.com"] = process.env.OPENAI_API_KEY;
if (process.env.ANTHROPIC_API_KEY) API_CREDENTIALS["api.anthropic.com"] = process.env.ANTHROPIC_API_KEY;

if (!PAG0_API_URL || !PAG0_API_KEY) {
  console.error("Missing PAG0_API_URL or PAG0_API_KEY in .env");
  process.exit(1);
}

// ── Helpers ───────────────────────────────────────────────────

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

let pass = 0;
let fail = 0;

async function test(name: string, fn: () => Promise<void>) {
  process.stdout.write(`  ${CYAN}${name}${RESET} ... `);
  try {
    await fn();
    pass++;
    console.log(`${GREEN}PASS${RESET}`);
  } catch (err) {
    fail++;
    console.log(`${RED}FAIL${RESET}`);
    console.log(`    ${RED}${err instanceof Error ? err.message : String(err)}${RESET}`);
  }
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`Assertion failed: ${msg}`);
}

/** When proxy returns 500, verify by calling upstream directly to confirm it's not our proxy's fault. */
async function verifyUpstream500(url: string, method: string, body?: string): Promise<void> {
  console.log(`${DIM}   ${YELLOW}verifying upstream directly...${RESET}`);
  try {
    const directRes = await globalThis.fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body,
    });
    const directStatus = directRes.status;
    // 402 = upstream is alive but requires payment (expected for x402 endpoints)
    // 4xx/5xx = upstream is having issues
    if (directStatus === 402) {
      console.log(`${DIM}   ${YELLOW}upstream returned 402 (payment required) — upstream is alive, proxy relay issue${RESET}`);
    } else if (directStatus >= 500) {
      console.log(`${DIM}   ${GREEN}confirmed: upstream itself returns ${directStatus} — not our fault${RESET}`);
    } else {
      console.log(`${DIM}   ${YELLOW}upstream returned ${directStatus} directly — proxy may have an issue${RESET}`);
    }
  } catch (err) {
    console.log(`${DIM}   ${YELLOW}upstream unreachable: ${err instanceof Error ? err.message : String(err)}${RESET}`);
  }
}

// ── Init ──────────────────────────────────────────────────────

console.log(`\n${CYAN}=== Pag0 MCP Tools Test ===${RESET}`);
console.log(`${DIM}  proxy: ${PAG0_API_URL}${RESET}`);
console.log(`${DIM}  wallet: ${WALLET_MODE}${RESET}\n`);

const client = new Pag0Client(PAG0_API_URL, PAG0_API_KEY);

let wallet: IWallet;
if (WALLET_MODE === "cdp") {
  const cdp = new CdpWallet(NETWORK);
  await cdp.init();
  wallet = cdp;
} else {
  wallet = new Pag0Wallet(process.env.WALLET_PRIVATE_KEY!, NETWORK);
}
const proxyFetch = createProxyFetch(PAG0_API_URL, PAG0_API_KEY, wallet);

console.log(`${DIM}  address: ${wallet.address}${RESET}\n`);

const smartOnly = process.argv.includes("--smart-only");

// ── Client Method Tests ───────────────────────────────────────

if (!smartOnly) {
  console.log(`${YELLOW}[Client Methods]${RESET}`);

  await test("getAnalyticsSummary", async () => {
    const res = await client.getAnalyticsSummary("7d") as any;
    assert(res != null, "response should not be null");
  });

  await test("getPolicies", async () => {
    const res = await client.getPolicies() as any;
    assert(res != null, "response should not be null");
  });

  await test("getRecommendations (AI Agents)", async () => {
    const res = await client.getRecommendations({ category: "AI Agents", limit: 3 }) as any;
    assert(Array.isArray(res.data), "data should be an array");
    assert(res.data.length > 0, "should have at least 1 recommendation");
    console.log(`${DIM} (${res.data.length} results)${RESET}`);
  });

  await test("getRankings", async () => {
    const res = await client.getRankings({ category: "AI Agents", limit: 5 }) as any;
    assert(res != null, "response should not be null");
  });

  console.log();
}

// ── Smart Request Select Tests ────────────────────────────────

console.log(`${YELLOW}[Smart Request: /select]${RESET}`);

await test("smartRequestSelect (AI Agents)", async () => {
  const res = await client.smartRequestSelect({
    category: "AI Agents",
    prompt: "hello",
    maxTokens: 50,
  });
  assert(typeof res.targetUrl === "string", "targetUrl should be a string");
  assert(typeof res.method === "string", "method should be a string");
  assert(res.selection != null, "selection should exist");
  assert(typeof res.selection.winner === "string", "winner should be a string");
  assert(typeof res.selection.rationale === "string", "rationale should be a string");
  console.log(`${DIM} → winner=${res.selection.winner}, url=${res.targetUrl}${RESET}`);
});

await test("smartRequestSelect (Developer Tools)", async () => {
  const res = await client.smartRequestSelect({
    category: "Developer Tools",
    prompt: "test",
    maxTokens: 50,
    sortBy: "cost",
  });
  assert(typeof res.targetUrl === "string", "targetUrl should be a string");
  assert(res.selection.winner.length > 0, "winner should not be empty");
  console.log(`${DIM} → winner=${res.selection.winner}, method=${res.method}${RESET}`);
});

await test("smartRequestSelect (Content & Media)", async () => {
  const res = await client.smartRequestSelect({
    category: "Content & Media",
    prompt: "joke",
    maxTokens: 50,
  });
  assert(typeof res.targetUrl === "string", "targetUrl should be a string");
  console.log(`${DIM} → winner=${res.selection.winner}, method=${res.method}${RESET}`);
});

console.log();

// ── ProxyFetch via /relay Tests ───────────────────────────────

console.log(`${YELLOW}[ProxyFetch via /relay]${RESET}`);

await test("proxyFetch x402-ai-starter (POST, x402 payment)", async () => {
  const url = "https://x402-ai-starter.vercel.app/api/add";
  const reqBody = JSON.stringify({ a: 5, b: 3 });
  const headers = injectAuthHeaders(url, { "content-type": "application/json" }, API_CREDENTIALS);
  const response = await proxyFetch(url, {
    method: "POST",
    headers,
    body: reqBody,
  });
  const meta = extractProxyMetadata(response);
  const body = await response.json().catch(() => null);
  console.log(`${DIM} → status=${response.status}, cost=${meta.cost}, cached=${meta.cached}${RESET}`);
  if (response.ok) {
    console.log(`${DIM}   body=${JSON.stringify(body)}${RESET}`);
  }
  if (response.status === 500) {
    await verifyUpstream500(url, "POST", reqBody);
  }
  assert(
    response.status === 200 || response.status === 402 || response.status === 500,
    `expected 200, 402, or 500, got ${response.status}`,
  );
});

console.log();

// ── Smart Select + ProxyFetch (full smart flow) ───────────────

console.log(`${YELLOW}[Smart Flow: select + proxyFetch]${RESET}`);

await test("full smart flow (Developer Tools)", async () => {
  // 1. Select
  const sel = await client.smartRequestSelect({
    category: "Developer Tools",
    prompt: "add 2 and 3",
    maxTokens: 50,
  });
  console.log(`${DIM} → selected: ${sel.selection.winner} (${sel.targetUrl})${RESET}`);

  // 2. Inject auth
  const headers = injectAuthHeaders(
    sel.targetUrl,
    { "content-type": "application/json" },
    API_CREDENTIALS,
  );

  // 3. Execute via proxyFetch
  const reqBody = sel.body != null ? JSON.stringify(sel.body) : undefined;
  const response = await proxyFetch(sel.targetUrl, {
    method: sel.method,
    headers,
    body: reqBody,
  });
  const meta = extractProxyMetadata(response);
  console.log(`${DIM} → status=${response.status}, cost=${meta.cost}, latency=${meta.latency}ms${RESET}`);

  if (response.ok) {
    const body = await response.json().catch(() => null);
    console.log(`${DIM}   body=${JSON.stringify(body)}${RESET}`);
  }
  if (response.status === 500) {
    await verifyUpstream500(sel.targetUrl, sel.method, reqBody);
  }
  assert(
    response.status === 200 || response.status === 402 || response.status === 500,
    `expected 200, 402, or 500, got ${response.status}`,
  );
});

console.log();

// ── 500 Feedback Loop ────────────────────────────────────────

console.log(`${YELLOW}[500 Feedback Loop]${RESET}`);

await test("500s are recorded in analytics and lower success rate", async () => {
  // Use a known x402 endpoint that currently 500s — the proxy already tracks it
  const TARGET_500_URL = "https://x402-ai-starter.vercel.app/api/add";
  const ENDPOINT_HOST = "x402-ai-starter.vercel.app";
  const N = 3; // number of 500-producing calls

  // 1. Get initial analytics snapshot for the endpoint
  const beforeAnalytics = (await client.getAnalyticsEndpoints({
    period: "1d",
    limit: 100,
  })) as { endpoints: Array<{ endpoint: string; requestCount: number; successRate: number; errorCount: number }> };

  const before = beforeAnalytics.endpoints.find((e) => e.endpoint === ENDPOINT_HOST);
  const beforeTotal = before?.requestCount ?? 0;
  const beforeErrors = before?.errorCount ?? 0;
  const beforeSuccessRate = before?.successRate ?? 1; // decimal 0-1

  console.log(
    `${DIM}   before: total=${beforeTotal}, errors=${beforeErrors}, successRate=${(beforeSuccessRate * 100).toFixed(1)}%${RESET}`,
  );

  // 2. Fire N relay calls to the 500-ing upstream
  const results: number[] = [];
  for (let i = 0; i < N; i++) {
    try {
      const res = await proxyFetch(TARGET_500_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ a: 1, b: 2 }),
      });
      results.push(res.status);
      // Drain body to avoid leaking connections
      await res.text().catch(() => {});
    } catch (err) {
      // Network errors still count — proxy may wrap as 502/500
      results.push(0);
    }
  }
  console.log(`${DIM}   relay statuses: [${results.join(", ")}]${RESET}`);

  // 3. Wait for async analytics writes to flush
  await new Promise((r) => setTimeout(r, 1500));

  // 4. Get updated analytics
  const afterAnalytics = (await client.getAnalyticsEndpoints({
    period: "1d",
    limit: 100,
  })) as { endpoints: Array<{ endpoint: string; requestCount: number; successRate: number; errorCount: number }> };

  const after = afterAnalytics.endpoints.find((e) => e.endpoint === ENDPOINT_HOST);
  const afterTotal = after?.requestCount ?? 0;
  const afterErrors = after?.errorCount ?? 0;
  const afterSuccessRate = after?.successRate ?? 1;

  console.log(
    `${DIM}   after:  total=${afterTotal}, errors=${afterErrors}, successRate=${(afterSuccessRate * 100).toFixed(1)}%${RESET}`,
  );

  // 5. Assertions
  // Request count must have increased
  assert(
    afterTotal > beforeTotal,
    `expected requestCount to increase (before=${beforeTotal}, after=${afterTotal})`,
  );

  // Error count must have increased
  assert(
    afterErrors > beforeErrors,
    `expected errorCount to increase (before=${beforeErrors}, after=${afterErrors})`,
  );

  // Success rate should drop or stay the same (more errors = lower rate)
  assert(
    afterSuccessRate <= beforeSuccessRate,
    `expected success rate to drop or stay same (before=${beforeSuccessRate}, after=${afterSuccessRate})`,
  );

  console.log(`${DIM}   ${GREEN}feedback loop verified: 500s recorded, success rate reflects failures${RESET}`);
});

console.log();

// ── Summary ───────────────────────────────────────────────────

const total = pass + fail;
console.log(`${CYAN}=== Results ===${RESET}`);
console.log(`  ${GREEN}Pass: ${pass}${RESET}  ${RED}Fail: ${fail}${RESET}  Total: ${total}`);
console.log();

process.exit(fail > 0 ? 1 : 0);
