/**
 * Shared test infrastructure for MCP integration tests.
 *
 * Exports colors, test harness, and `init(envPath)` which returns
 * { wallet, client, proxyFetch, config }.
 */

import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";
import { Pag0Client } from "../src/client.js";
import { Pag0Wallet } from "../src/wallet.js";
import { CdpWallet } from "../src/cdp-wallet.js";
import type { IWallet } from "../src/wallet.js";
import { createProxyFetch } from "../src/proxy-fetch.js";

// ── Re-exports (used by test files) ─────────────────────────
export { Pag0Wallet } from "../src/wallet.js";
export type { IWallet } from "../src/wallet.js";
export { extractProxyMetadata } from "../src/proxy-fetch.js";
export { injectAuthHeaders } from "../src/tools/auth.js";

// ── Colors ───────────────────────────────────────────────────

export const GREEN = "\x1b[32m";
export const RED = "\x1b[31m";
export const YELLOW = "\x1b[33m";
export const CYAN = "\x1b[36m";
export const DIM = "\x1b[2m";
export const RESET = "\x1b[0m";

// ── Test Harness ─────────────────────────────────────────────

export let pass = 0;
export let fail = 0;

export async function test(name: string, fn: () => Promise<void>) {
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

export function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`Assertion failed: ${msg}`);
}

/** When proxy returns 500, verify by calling upstream directly to confirm it's not our proxy's fault. */
export async function verifyUpstream500(
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

export function printSummary() {
  const total = pass + fail;
  console.log(`${CYAN}=== Results ===${RESET}`);
  console.log(
    `  ${GREEN}Pass: ${pass}${RESET}  ${RED}Fail: ${fail}${RESET}  Total: ${total}`,
  );
  console.log();
}

// ── Init ─────────────────────────────────────────────────────

export interface TestConfig {
  apiUrl: string;
  apiKey: string;
  walletMode: string;
  network: string;
  chainId: number;
  apiCredentials: Record<string, string>;
}

export interface TestContext {
  wallet: IWallet;
  client: Pag0Client;
  proxyFetch: ReturnType<typeof createProxyFetch>;
  config: TestConfig;
}

/**
 * Load env file, create wallet/client/proxyFetch, print header.
 * @param envPath - path relative to packages/mcp (e.g. ".env.bsc.production.local")
 * @param title - header title for console output
 */
export async function init(envPath: string, title: string): Promise<TestContext> {
  const pkgRoot = resolve(import.meta.dirname, "..");
  dotenvConfig({ path: resolve(pkgRoot, envPath), override: true });

  const apiUrl = process.env.PAG0_API_URL!;
  const apiKey = process.env.PAG0_API_KEY!;
  const walletMode = process.env.WALLET_MODE ?? "local";
  const network = process.env.NETWORK ?? "base-sepolia";
  const chainId = network === "bsc" ? 56 : 84532;

  if (!apiUrl || !apiKey) {
    console.error("Missing PAG0_API_URL or PAG0_API_KEY in .env");
    process.exit(1);
  }

  const apiCredentials: Record<string, string> = {};
  if (process.env.OPENAI_API_KEY)
    apiCredentials["api.openai.com"] = process.env.OPENAI_API_KEY;
  if (process.env.ANTHROPIC_API_KEY)
    apiCredentials["api.anthropic.com"] = process.env.ANTHROPIC_API_KEY;

  // Create wallet
  let wallet: IWallet;
  if (walletMode === "cdp") {
    const cdp = new CdpWallet(network);
    await cdp.init();
    wallet = cdp;
  } else {
    if (!process.env.WALLET_PRIVATE_KEY) {
      throw new Error("WALLET_PRIVATE_KEY is required for local wallet mode");
    }
    wallet = new Pag0Wallet(process.env.WALLET_PRIVATE_KEY!, network);
  }

  const client = new Pag0Client(apiUrl, apiKey, chainId);
  const proxyFetch = createProxyFetch(apiUrl, apiKey, wallet, chainId);

  const config: TestConfig = { apiUrl, apiKey, walletMode, network, chainId, apiCredentials };

  // Print header
  console.log(`\n${CYAN}=== ${title} ===${RESET}`);
  console.log(`${DIM}  env:     ${envPath}${RESET}`);
  console.log(`${DIM}  proxy:   ${apiUrl}${RESET}`);
  console.log(`${DIM}  wallet:  ${walletMode}${RESET}`);
  console.log(`${DIM}  network: ${network}${RESET}`);
  console.log(`${DIM}  address: ${wallet.address}${RESET}\n`);

  return { wallet, client, proxyFetch, config };
}
