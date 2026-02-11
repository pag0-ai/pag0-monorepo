import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IWallet } from "../wallet.js";

export function registerWalletTools(
  server: McpServer,
  wallet: IWallet,
) {
  server.tool(
    "pag0_wallet_status",
    "Check agent wallet address, USDC balance, network, and wallet mode (local/cdp). Use this before making paid API calls to verify sufficient funds.",
    {},
    async () => {
      const status = await wallet.getStatus();
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ ...status, walletMode: wallet.walletMode }, null, 2),
          },
        ],
      };
    },
  );
}
