import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Pag0Wallet } from "../wallet.js";

export function registerWalletTools(
  server: McpServer,
  wallet: Pag0Wallet,
) {
  server.tool(
    "pag0_wallet_status",
    "Check agent wallet address, USDC balance, and network. Use this before making paid API calls to verify sufficient funds.",
    {},
    async () => {
      const status = await wallet.getStatus();
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(status, null, 2),
          },
        ],
      };
    },
  );
}
