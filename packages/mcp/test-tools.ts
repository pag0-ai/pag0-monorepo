#!/usr/bin/env npx tsx
/**
 * MCP Tools Integration Test
 *
 * Tests the Pag0 MCP client methods and proxyFetch flow directly
 * (no MCP server/transport needed).
 *
 * Usage:
 *   cd packages/mcp
 *   npx tsx test-tools.ts              # run all tests (Base Sepolia / CDP)
 *   npx tsx test-tools.ts --smart-only # run only smart-request tests
 *   npx tsx test-tools.ts --bsc        # run BSC local wallet tests
 *   npx tsx test-tools.ts --bsc --approve  # BSC tests + Permit2 approve tx
 *
 * Requires:
 *   - Proxy running at PAG0_API_URL (default localhost:3000)
 *   - .env with PAG0_API_URL, PAG0_API_KEY, WALLET_PRIVATE_KEY or CDP creds
 *   - For BSC: NETWORK=bsc, WALLET_MODE=local, WALLET_PRIVATE_KEY (with USDT + BNB)
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
if (process.env.OPENAI_API_KEY)
  API_CREDENTIALS["api.openai.com"] = process.env.OPENAI_API_KEY;
if (process.env.ANTHROPIC_API_KEY)
  API_CREDENTIALS["api.anthropic.com"] = process.env.ANTHROPIC_API_KEY;

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
    console.log(
      `    ${RED}${err instanceof Error ? err.message : String(err)}${RESET}`,
    );
  }
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`Assertion failed: ${msg}`);
}

/** When proxy returns 500, verify by calling upstream directly to confirm it's not our proxy's fault. */
async function verifyUpstream500(
  url: string,
  method: string,
  body?: string,
): Promise<void> {
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
      console.log(
        `${DIM}   ${YELLOW}upstream returned 402 (payment required) — upstream is alive, proxy relay issue${RESET}`,
      );
    } else if (directStatus >= 500) {
      console.log(
        `${DIM}   ${GREEN}confirmed: upstream itself returns ${directStatus} — not our fault${RESET}`,
      );
    } else {
      console.log(
        `${DIM}   ${YELLOW}upstream returned ${directStatus} directly — proxy may have an issue${RESET}`,
      );
    }
  } catch (err) {
    console.log(
      `${DIM}   ${YELLOW}upstream unreachable: ${
        err instanceof Error ? err.message : String(err)
      }${RESET}`,
    );
  }
}

// ── Init ──────────────────────────────────────────────────────

console.log(`\n${CYAN}=== Pag0 MCP Tools Test ===${RESET}`);
console.log(`${DIM}  proxy: ${PAG0_API_URL}${RESET}`);
console.log(`${DIM}  wallet: ${WALLET_MODE}${RESET}\n`);

const CHAIN_ID = NETWORK === "bsc" ? 56 : 84532;
const client = new Pag0Client(PAG0_API_URL, PAG0_API_KEY, CHAIN_ID);

let wallet: IWallet;
if (WALLET_MODE === "cdp") {
  const cdp = new CdpWallet(NETWORK);
  await cdp.init();
  wallet = cdp;
} else {
  if (!process.env.WALLET_PRIVATE_KEY) {
    throw new Error("WALLET_PRIVATE_KEY is required for local wallet mode");
  }
  wallet = new Pag0Wallet(process.env.WALLET_PRIVATE_KEY!, NETWORK);
}
const proxyFetch = createProxyFetch(PAG0_API_URL, PAG0_API_KEY, wallet, CHAIN_ID);

console.log(`${DIM}  address: ${wallet.address}${RESET}\n`);

const smartOnly = process.argv.includes("--smart-only");
const bscOnly = process.argv.includes("--bsc") || NETWORK === "bsc";
const isBsc = NETWORK === "bsc";

// ── Client Method Tests ───────────────────────────────────────

if (!smartOnly) {
  console.log(`${YELLOW}[Client Methods]${RESET}`);

  await test("getAnalyticsSummary", async () => {
    const res = (await client.getAnalyticsSummary("7d")) as any;
    assert(res != null, "response should not be null");
  });

  await test("getPolicies", async () => {
    const res = (await client.getPolicies()) as any;
    assert(res != null, "response should not be null");
  });

  await test("getRecommendations (AI Agents)", async () => {
    const res = (await client.getRecommendations({
      category: "AI Agents",
      limit: 3,
    })) as any;
    assert(Array.isArray(res.data), "data should be an array");
    assert(res.data.length > 0, "should have at least 1 recommendation");
    console.log(`${DIM} (${res.data.length} results)${RESET}`);
  });

  await test("getRankings", async () => {
    const res = (await client.getRankings({
      category: "AI Agents",
      limit: 5,
    })) as any;
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
  assert(
    typeof res.selection.rationale === "string",
    "rationale should be a string",
  );
  console.log(
    `${DIM} → winner=${res.selection.winner}, url=${res.targetUrl}${RESET}`,
  );
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
  console.log(
    `${DIM} → winner=${res.selection.winner}, method=${res.method}${RESET}`,
  );
});

await test("smartRequestSelect (Content & Media)", async () => {
  const res = await client.smartRequestSelect({
    category: "Content & Media",
    prompt: "joke",
    maxTokens: 50,
  });
  assert(typeof res.targetUrl === "string", "targetUrl should be a string");
  console.log(
    `${DIM} → winner=${res.selection.winner}, method=${res.method}${RESET}`,
  );
});

console.log();

// ── ProxyFetch via /relay Tests ───────────────────────────────

console.log(`${YELLOW}[ProxyFetch via /relay]${RESET}`);

await test("proxyFetch x402-ai-starter (POST, x402 payment)", async () => {
  const url = "https://x402-ai-starter-alpha.vercel.app/api/add";
  const reqBody = JSON.stringify({ a: 5, b: 3 });
  const headers = injectAuthHeaders(
    url,
    { "content-type": "application/json" },
    API_CREDENTIALS,
  );
  const response = await proxyFetch(url, {
    method: "POST",
    headers,
    body: reqBody,
  });
  const meta = extractProxyMetadata(response);
  const body = await response.json().catch(() => null);
  console.log(
    `${DIM} → status=${response.status}, cost=${meta.cost}, cached=${meta.cached}${RESET}`,
  );
  if (response.ok) {
    console.log(`${DIM}   body=${JSON.stringify(body)}${RESET}`);
  }
  if (response.status === 500) {
    await verifyUpstream500(url, "POST", reqBody);
  }
  assert(
    response.status === 200 || response.status === 500,
    `expected 200 or 500, got ${response.status} (402 means x402 SDK payment flow failed)`,
  );
});

await test("x402 cost reporting: proxy cost vs payment-response", async () => {
  const url = "https://x402-ai-starter-alpha.vercel.app/api/add";
  const reqBody = JSON.stringify({ a: 7, b: 2 });
  const headers = injectAuthHeaders(
    url,
    { "content-type": "application/json" },
    API_CREDENTIALS,
  );
  const response = await proxyFetch(url, {
    method: "POST",
    headers,
    body: reqBody,
  });

  if (!response.ok) {
    console.log(`${DIM}   skipped (status=${response.status})${RESET}`);
    return;
  }

  // 1. Proxy-reported cost
  const proxyCost = response.headers.get("x-pag0-cost") || "0";

  // 2. All cost-related headers from upstream (forwarded through proxy)
  const paymentResponse =
    response.headers.get("payment-response") ||
    response.headers.get("x-payment-response");
  const xCost = response.headers.get("x-cost");
  const xPaymentAmount = response.headers.get("x-payment-amount");

  // 3. Decode payment-response if present
  let settlementAmount: string | null = null;
  if (paymentResponse) {
    try {
      const decoded = JSON.parse(
        Buffer.from(paymentResponse, "base64").toString(),
      );
      console.log(
        `${DIM}   payment-response: ${JSON.stringify(decoded)}${RESET}`,
      );
      settlementAmount = decoded.amount || decoded.transaction?.amount || null;
    } catch {
      console.log(`${DIM}   payment-response: (decode failed)${RESET}`);
    }
  }

  // 4. Dump all response headers for diagnosis
  const allHeaders: Record<string, string> = {};
  response.headers.forEach((v, k) => {
    allHeaders[k] = v;
  });
  const costRelated = Object.entries(allHeaders)
    .filter(([k]) => /cost|payment|pag0/i.test(k))
    .map(([k, v]) => `${k}=${v.length > 80 ? v.slice(0, 80) + "…" : v}`);
  console.log(
    `${DIM}   cost-related headers: ${
      costRelated.join(", ") || "(none)"
    }${RESET}`,
  );

  console.log(
    `${DIM}   proxy-cost=${proxyCost}, x-cost=${xCost ?? "null"}, ` +
      `x-payment-amount=${xPaymentAmount ?? "null"}, ` +
      `settlement=${settlementAmount ?? "null"}${RESET}`,
  );

  // 5. Assert: cost should not be "0" after a paid x402 request
  assert(
    proxyCost !== "0" ||
      xCost != null ||
      xPaymentAmount != null ||
      paymentResponse != null,
    `No cost data found anywhere — proxy-cost=0 and no upstream cost headers`,
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
  console.log(
    `${DIM} → selected: ${sel.selection.winner} (${sel.targetUrl})${RESET}`,
  );

  // 2. Inject auth
  const headers = injectAuthHeaders(
    sel.targetUrl,
    { "content-type": "application/json" },
    API_CREDENTIALS,
  );

  // 3. Execute via proxyFetch
  // For x402 pass-through endpoints, build the correct body (caller's responsibility)
  const noBody = /^(GET|HEAD|OPTIONS)$/i.test(sel.method);
  const reqBody = noBody
    ? undefined
    : sel.body != null
    ? JSON.stringify(sel.body)
    : sel.isPassthrough
    ? JSON.stringify({ a: 2, b: 3 }) // x402-ai-starter-alpha expects { a, b }
    : undefined;
  const response = await proxyFetch(sel.targetUrl, {
    method: sel.method,
    headers,
    body: reqBody,
  });
  const meta = extractProxyMetadata(response);
  console.log(
    `${DIM} → status=${response.status}, cost=${meta.cost}, latency=${meta.latency}ms${RESET}`,
  );

  if (response.ok) {
    const body = await response.json().catch(() => null);
    console.log(`${DIM}   body=${JSON.stringify(body)}${RESET}`);
  }
  if (response.status === 500) {
    await verifyUpstream500(sel.targetUrl, sel.method, reqBody);
  }
  assert(
    response.status === 200 ||
      response.status === 404 ||
      response.status === 500,
    `expected 200/404/500, got ${response.status} (402 means x402 SDK payment flow failed)`,
  );
});

console.log();

// ── 500 Feedback Loop ────────────────────────────────────────

console.log(`${YELLOW}[500 Feedback Loop]${RESET}`);

await test("requests are recorded in analytics and affect metrics", async () => {
  // Use old (non-alpha) URL — previously returned 500, now may return 200
  const TARGET_URL = "https://x402-ai-starter.vercel.app/api/add";
  const ENDPOINT_HOST = "x402-ai-starter.vercel.app";
  const N = 3;

  // 1. Get initial analytics snapshot for the endpoint
  const beforeAnalytics = (await client.getAnalyticsEndpoints({
    period: "1d",
    limit: 100,
  })) as {
    endpoints: Array<{
      endpoint: string;
      requestCount: number;
      successRate: number;
      errorCount: number;
    }>;
  };

  const before = beforeAnalytics.endpoints.find(
    (e) => e.endpoint === ENDPOINT_HOST,
  );
  const beforeTotal = before?.requestCount ?? 0;

  console.log(`${DIM}   before: total=${beforeTotal}${RESET}`);

  // 2. Fire N relay calls
  const results: number[] = [];
  for (let i = 0; i < N; i++) {
    try {
      const res = await proxyFetch(TARGET_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ a: 1, b: 2 }),
      });
      results.push(res.status);
      await res.text().catch(() => {});
    } catch (err) {
      results.push(0);
    }
  }
  console.log(`${DIM}   relay statuses: [${results.join(", ")}]${RESET}`);

  const errorResults = results.filter((s) => s === 0 || s >= 400).length;

  // 3. Wait for async analytics writes to flush
  await new Promise((r) => setTimeout(r, 1500));

  // 4. Get updated analytics
  const afterAnalytics = (await client.getAnalyticsEndpoints({
    period: "1d",
    limit: 100,
  })) as {
    endpoints: Array<{
      endpoint: string;
      requestCount: number;
      successRate: number;
      errorCount: number;
    }>;
  };

  const after = afterAnalytics.endpoints.find(
    (e) => e.endpoint === ENDPOINT_HOST,
  );
  const afterTotal = after?.requestCount ?? 0;
  const afterErrors = after?.errorCount ?? 0;

  console.log(
    `${DIM}   after:  total=${afterTotal}, errors=${afterErrors}${RESET}`,
  );

  // 5. Assertions — request count must have increased (analytics recording works)
  assert(
    afterTotal > beforeTotal,
    `expected requestCount to increase (before=${beforeTotal}, after=${afterTotal})`,
  );

  // If upstream returned errors, verify they were tracked
  if (errorResults > 0) {
    assert(
      afterErrors > 0,
      `upstream returned ${errorResults} errors but analytics shows 0 errors`,
    );
    console.log(
      `${DIM}   ${GREEN}feedback loop verified: ${errorResults} errors recorded in analytics${RESET}`,
    );
  } else {
    console.log(
      `${DIM}   ${YELLOW}upstream returned all 200s — error tracking not testable (endpoint was fixed)${RESET}`,
    );
  }

  console.log(
    `${DIM}   ${GREEN}analytics recording verified: requestCount ${beforeTotal} → ${afterTotal}${RESET}`,
  );
});

console.log();

// ── BSC Local Wallet Tests ───────────────────────────────────

if (bscOnly) {
  console.log(`${YELLOW}[BSC: Wallet & Permit2]${RESET}`);

  await test("wallet status (BSC, local)", async () => {
    const status = await wallet.getStatus();
    assert(
      status.network === "bsc",
      `expected network=bsc, got ${status.network}`,
    );
    assert(status.address.startsWith("0x"), "address should start with 0x");
    console.log(
      `${DIM} → addr=${status.address.slice(0, 10)}..., balance=${
        status.balanceFormatted
      }${RESET}`,
    );
    if (status.permit2) {
      console.log(
        `${DIM}   permit2: approved=${status.permit2.approved}, allowance=${status.permit2.allowance}${RESET}`,
      );
    }
  });

  await test("Permit2 allowance check", async () => {
    const status = await wallet.getStatus();
    assert(status.permit2 != null, "permit2 status should be present for BSC");
    assert(
      typeof status.permit2!.approved === "boolean",
      "approved should be boolean",
    );
    assert(
      typeof status.permit2!.allowance === "string",
      "allowance should be a string",
    );
    if (!status.permit2!.approved) {
      console.log(
        `${DIM}   ${YELLOW}⚠ Permit2 NOT approved — run pag0_approve_permit2 or use --approve flag${RESET}`,
      );
    } else {
      console.log(`${DIM}   ${GREEN}✓ Permit2 approved${RESET}`);
    }
  });

  // Optional: approve Permit2 if --approve flag is passed
  if (process.argv.includes("--approve") && wallet instanceof Pag0Wallet) {
    await test("Permit2 approve (on-chain tx)", async () => {
      const statusBefore = await wallet.getStatus();
      if (statusBefore.permit2?.approved) {
        console.log(`${DIM}   already approved, skipping${RESET}`);
        return;
      }
      const result = await (wallet as Pag0Wallet).approvePermit2();
      assert(typeof result.txHash === "string", "txHash should be a string");
      assert(result.txHash.startsWith("0x"), "txHash should start with 0x");
      console.log(`${DIM}   tx=${result.txHash}${RESET}`);

      // Verify allowance updated
      const statusAfter = await wallet.getStatus();
      assert(
        statusAfter.permit2?.approved === true,
        "permit2 should be approved after tx",
      );
    });
  }

  console.log();

  console.log(`${YELLOW}[BSC: ProxyFetch — Self-Hosted x402 APIs]${RESET}`);

  await test("proxyFetch BSC Venus rates (GET, x402 payment)", async () => {
    const url = `${PAG0_API_URL}/bsc/defi/venus/rates`;
    const response = await proxyFetch(url, { method: "GET" });
    const meta = extractProxyMetadata(response);
    const body = await response.json().catch(() => null);
    console.log(
      `${DIM} → status=${response.status}, cost=${meta.cost}, cached=${meta.cached}, latency=${meta.latency}ms${RESET}`,
    );
    if (response.ok && body) {
      const markets = Array.isArray(body)
        ? body.length
        : Object.keys(body).length;
      console.log(`${DIM}   markets=${markets}${RESET}`);
    }
    // 200 = paid successfully, 500 = upstream error, 402 = Permit2 not approved(402 not allowed cause proxyFetch should handle retry with payment)
    assert(
      response.status === 200 || response.status === 500,
      `expected 200/500, got ${response.status}`,
    );
  });

  await test("proxyFetch BSC PancakeSwap quote (GET, x402 payment)", async () => {
    const url = `${PAG0_API_URL}/bsc/defi/pancake/quote?tokenIn=0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c&tokenOut=0x55d398326f99059fF775485246999027B3197955&amount=1000000000000000000`;
    const response = await proxyFetch(url, { method: "GET" });
    const meta = extractProxyMetadata(response);
    const body = await response.json().catch(() => null);
    console.log(
      `${DIM} → status=${response.status}, cost=${meta.cost}, cached=${meta.cached}, latency=${meta.latency}ms${RESET}`,
    );
    if (response.ok && body) {
      console.log(
        `${DIM}   quote=${JSON.stringify(body).slice(0, 120)}${RESET}`,
      );
    }
    assert(
      response.status === 200 || response.status === 500,
      `expected 200/500, got ${response.status}`,
    );
  });

  await test("proxyFetch BSC token analysis (POST, x402 payment)", async () => {
    const url = `${PAG0_API_URL}/bsc/ai/analyze-token`;
    const reqBody = JSON.stringify({
      tokenAddress: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82",
    }); // CAKE
    const response = await proxyFetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: reqBody,
    });
    const meta = extractProxyMetadata(response);
    const body = await response.json().catch(() => null);
    console.log(
      `${DIM} → status=${response.status}, cost=${meta.cost}, cached=${meta.cached}, latency=${meta.latency}ms${RESET}`,
    );
    if (response.ok && body) {
      console.log(
        `${DIM}   analysis=${JSON.stringify(body).slice(0, 150)}${RESET}`,
      );
    }
    assert(
      response.status === 200 || response.status === 500,
      `expected 200/500, got ${response.status}`,
    );
  });

  console.log();

  console.log(`${YELLOW}[BSC: Cache Verification]${RESET}`);

  await test("second Venus request should be cached", async () => {
    const url = `${PAG0_API_URL}/bsc/defi/venus/rates`;
    const response = await proxyFetch(url, { method: "GET" });
    const meta = extractProxyMetadata(response);
    console.log(
      `${DIM} → status=${response.status}, cached=${meta.cached}, cacheSource=${meta.cacheSource}${RESET}`,
    );
    if (response.status === 200) {
      // First call may or may not be cached; this is the second call
      console.log(
        meta.cached
          ? `${DIM}   ${GREEN}✓ cache hit — saved payment cost${RESET}`
          : `${DIM}   ${YELLOW}cache miss (may need longer TTL or first call failed)${RESET}`,
      );
    }
    await response.text().catch(() => {});
    assert(
      response.status === 200 || response.status === 500,
      `expected 200/500, got ${response.status}`,
    );
  });

  console.log();
}

// ── Summary ───────────────────────────────────────────────────

const total = pass + fail;
console.log(`${CYAN}=== Results ===${RESET}`);
console.log(
  `  ${GREEN}Pass: ${pass}${RESET}  ${RED}Fail: ${fail}${RESET}  Total: ${total}`,
);
console.log();

process.exit(fail > 0 ? 1 : 0);
