#!/usr/bin/env node
/**
 * Pag0 MCP Server — Demo Agent for Claude Code
 *
 * Connects Claude Code to the Pag0 Smart Proxy via MCP (stdio transport).
 * Provides tools for: wallet status, proxy requests (with x402 payment),
 * budget/policy checks, API curation, and analytics.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Pag0Client } from "./client.js";
import { Pag0Wallet } from "./wallet.js";
import type { IWallet } from "./wallet.js";
import { CdpWallet } from "./cdp-wallet.js";
import { registerWalletTools } from "./tools/wallet.js";
import { registerWalletFundTools } from "./tools/wallet-fund.js";
import { registerProxyTools } from "./tools/proxy.js";
import { createProxyFetch } from "./proxy-fetch.js";
import { registerPolicyTools } from "./tools/policy.js";
import { registerCurationTools } from "./tools/curation.js";
import { registerAnalyticsTools } from "./tools/analytics.js";
import { registerSmartTools } from "./tools/smart.js";
import { registerAuditTools } from "./tools/audit.js";

// ── Environment ────────────────────────────────────────────

const PAG0_API_URL = process.env.PAG0_API_URL;
const PAG0_API_KEY = process.env.PAG0_API_KEY;
const WALLET_PRIVATE_KEY = process.env.WALLET_PRIVATE_KEY;
const WALLET_MODE = process.env.WALLET_MODE ?? "local";
const NETWORK = process.env.NETWORK || "base-sepolia";

// Optional: auto-inject Authorization headers for known API providers
const API_CREDENTIALS: Record<string, string> = {};
if (process.env.OPENAI_API_KEY) API_CREDENTIALS["api.openai.com"] = process.env.OPENAI_API_KEY;
if (process.env.ANTHROPIC_API_KEY) API_CREDENTIALS["api.anthropic.com"] = process.env.ANTHROPIC_API_KEY;

if (!PAG0_API_URL || !PAG0_API_KEY) {
  console.error("Missing required env vars: PAG0_API_URL, PAG0_API_KEY");
  process.exit(1);
}

if (WALLET_MODE === "local" && !WALLET_PRIVATE_KEY) {
  console.error("Missing WALLET_PRIVATE_KEY (required when WALLET_MODE=local)");
  process.exit(1);
}

// ── Bootstrap ──────────────────────────────────────────────

const server = new McpServer({
  name: "pag0",
  version: "0.1.0",
});

const client = new Pag0Client(PAG0_API_URL, PAG0_API_KEY);

// Wallet mode selection: local (ethers) or cdp (Coinbase Server Wallet)
let wallet: IWallet;
if (WALLET_MODE === "cdp") {
  const cdpWallet = new CdpWallet(NETWORK);
  await cdpWallet.init();
  wallet = cdpWallet;
  console.error("[pag0-mcp] CDP Server Wallet initialized:", wallet.address);
} else {
  wallet = new Pag0Wallet(WALLET_PRIVATE_KEY!, NETWORK);
  console.error("[pag0-mcp] Local ethers.Wallet initialized:", wallet.address);
}

// Create proxy-aware fetch (x402 SDK handles 402 → sign → retry)
const proxyFetch = createProxyFetch(PAG0_API_URL, PAG0_API_KEY, wallet);

// Register all tools
registerWalletTools(server, wallet);
registerWalletFundTools(server, wallet);
registerProxyTools(server, proxyFetch, API_CREDENTIALS);
registerPolicyTools(server, client);
registerCurationTools(server, client);
registerAnalyticsTools(server, client);
registerSmartTools(server, client, wallet);
registerAuditTools(server, client);

// ── Connect ────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
