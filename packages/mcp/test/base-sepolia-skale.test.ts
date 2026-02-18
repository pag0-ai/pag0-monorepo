#!/usr/bin/env npx tsx
/**
 * Base Sepolia + SKALE Integration Tests
 *
 * Tests MCP client methods, smart request, proxyFetch, and analytics
 * against Base Sepolia x402 endpoints with CDP or local wallet.
 *
 * Usage:
 *   cd packages/mcp
 *   npx tsx test/base-sepolia-skale.test.ts              # run all tests
 *   npx tsx test/base-sepolia-skale.test.ts --smart-only  # smart-request tests only
 */

import {
  init,
  printSummary,
  test,
  assert,
  verifyUpstream500,
  extractProxyMetadata,
  injectAuthHeaders,
  fail,
  GREEN,
  YELLOW,
  DIM,
  RESET,
} from "./common.js";

const ENV_FILE = ".env.skale.production.local";
const { client, proxyFetch, config } = await init(ENV_FILE, "Base Sepolia / SKALE Tests");

const smartOnly = process.argv.includes("--smart-only");

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
    config.apiCredentials,
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
    config.apiCredentials,
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
    config.apiCredentials,
  );

  // 3. Execute via proxyFetch
  const noBody = /^(GET|HEAD|OPTIONS)$/i.test(sel.method);
  const reqBody = noBody
    ? undefined
    : sel.body != null
    ? JSON.stringify(sel.body)
    : sel.isPassthrough
    ? JSON.stringify({ a: 2, b: 3 })
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

  // 5. Assertions — request count must have increased
  assert(
    afterTotal > beforeTotal,
    `expected requestCount to increase (before=${beforeTotal}, after=${afterTotal})`,
  );

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

// ── Summary ───────────────────────────────────────────────────

printSummary();
process.exit(fail > 0 ? 1 : 0);
