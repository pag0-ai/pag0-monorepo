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
import { registerWalletTools } from "./tools/wallet.js";
import { registerProxyTools } from "./tools/proxy.js";
import { registerPolicyTools } from "./tools/policy.js";
import { registerCurationTools } from "./tools/curation.js";
import { registerAnalyticsTools } from "./tools/analytics.js";

// ── Environment ────────────────────────────────────────────

const PAG0_API_URL = process.env.PAG0_API_URL;
const PAG0_API_KEY = process.env.PAG0_API_KEY;
const WALLET_PRIVATE_KEY = process.env.WALLET_PRIVATE_KEY;
const NETWORK = process.env.NETWORK || "base-sepolia";

if (!PAG0_API_URL || !PAG0_API_KEY || !WALLET_PRIVATE_KEY) {
  console.error(
    "Missing required env vars: PAG0_API_URL, PAG0_API_KEY, WALLET_PRIVATE_KEY",
  );
  process.exit(1);
}

// ── Bootstrap ──────────────────────────────────────────────

const server = new McpServer({
  name: "pag0",
  version: "0.1.0",
});

const client = new Pag0Client(PAG0_API_URL, PAG0_API_KEY);
const wallet = new Pag0Wallet(WALLET_PRIVATE_KEY, NETWORK);

// Register all tools
registerWalletTools(server, wallet);
registerProxyTools(server, client, wallet);
registerPolicyTools(server, client);
registerCurationTools(server, client);
registerAnalyticsTools(server, client);

// ── Connect ────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
