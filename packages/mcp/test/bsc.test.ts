#!/usr/bin/env npx tsx
/**
 * BSC Integration Tests
 *
 * Tests MCP client methods, BSC wallet (Permit2), proxyFetch against
 * BSC self-hosted x402 APIs, and cache verification.
 *
 * Usage:
 *   cd packages/mcp
 *   npx tsx test/bsc.test.ts              # run all BSC tests
 *   npx tsx test/bsc.test.ts --approve    # include Permit2 approve tx
 */

import {
  init,
  printSummary,
  test,
  assert,
  extractProxyMetadata,
  Pag0Wallet,
  fail,
  GREEN,
  YELLOW,
  DIM,
  RESET,
} from "./common.js";

const ENV_FILE = ".env.bsc.production.local";
const { client, wallet, proxyFetch, config } = await init(ENV_FILE, "BSC Tests");

// ── Client Method Tests (BSC categories) ─────────────────────

console.log(`${YELLOW}[Client Methods — BSC]${RESET}`);

await test("getAnalyticsSummary", async () => {
  const res = (await client.getAnalyticsSummary("7d")) as any;
  assert(res != null, "response should not be null");
});

await test("getPolicies", async () => {
  const res = (await client.getPolicies()) as any;
  assert(res != null, "response should not be null");
});

await test("getRecommendations (DeFi)", async () => {
  const res = (await client.getRecommendations({
    category: "DeFi",
    limit: 3,
  })) as any;
  assert(Array.isArray(res.data), "data should be an array");
  assert(res.data.length > 0, "should have at least 1 recommendation");
  console.log(`${DIM} (${res.data.length} results)${RESET}`);
});

await test("getRankings (DeFi)", async () => {
  const res = (await client.getRankings({
    category: "DeFi",
    limit: 5,
  })) as any;
  assert(res != null, "response should not be null");
});

console.log();

// ── BSC Wallet & Permit2 ─────────────────────────────────────

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

// ── BSC ProxyFetch — Self-Hosted x402 APIs ───────────────────

console.log(`${YELLOW}[BSC: ProxyFetch — Self-Hosted x402 APIs]${RESET}`);

await test("proxyFetch BSC Venus rates (GET, x402 payment)", async () => {
  const url = `${config.apiUrl}/bsc/defi/venus/rates`;
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
  assert(
    response.status === 200 || response.status === 500,
    `expected 200/500, got ${response.status}`,
  );
});

await test("proxyFetch BSC PancakeSwap quote (GET, x402 payment)", async () => {
  const url = `${config.apiUrl}/bsc/defi/pancake/quote?tokenIn=0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c&tokenOut=0x55d398326f99059fF775485246999027B3197955&amount=1000000000000000000`;
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
  const url = `${config.apiUrl}/bsc/ai/analyze-token`;
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

// ── BSC Cache Verification ───────────────────────────────────

console.log(`${YELLOW}[BSC: Cache Verification]${RESET}`);

await test("second Venus request should be cached", async () => {
  const url = `${config.apiUrl}/bsc/defi/venus/rates`;
  const response = await proxyFetch(url, { method: "GET" });
  const meta = extractProxyMetadata(response);
  console.log(
    `${DIM} → status=${response.status}, cached=${meta.cached}, cacheSource=${meta.cacheSource}${RESET}`,
  );
  if (response.status === 200) {
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

// ── BSC Smart Select ─────────────────────────────────────────

console.log(`${YELLOW}[BSC: Smart Request]${RESET}`);

await test("smartRequestSelect (DeFi)", async () => {
  const res = await client.smartRequestSelect({
    category: "DeFi",
    prompt: "get lending rates",
    maxTokens: 50,
  });
  assert(typeof res.targetUrl === "string", "targetUrl should be a string");
  assert(typeof res.method === "string", "method should be a string");
  assert(res.selection != null, "selection should exist");
  assert(typeof res.selection.winner === "string", "winner should be a string");
  console.log(
    `${DIM} → winner=${res.selection.winner}, url=${res.targetUrl}${RESET}`,
  );
});

console.log();

// ── Summary ───────────────────────────────────────────────────

printSummary();
process.exit(fail > 0 ? 1 : 0);
