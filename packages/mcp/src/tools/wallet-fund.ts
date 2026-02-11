import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IWallet } from "../wallet.js";
import type { CdpWallet } from "../cdp-wallet.js";

export function registerWalletFundTools(
  server: McpServer,
  wallet: IWallet,
) {
  server.tool(
    "pag0_wallet_fund",
    "Request testnet USDC from faucet (Base Sepolia only). Only available when using CDP wallet mode (WALLET_MODE=cdp).",
    {},
    async () => {
      if (wallet.walletMode !== "cdp") {
        return {
          content: [
            {
              type: "text" as const,
              text: "Faucet is only available with CDP wallet mode (WALLET_MODE=cdp)",
            },
          ],
          isError: true,
        };
      }
      try {
        const txHash = await (wallet as CdpWallet).requestFaucet();
        return {
          content: [
            {
              type: "text" as const,
              text: `Faucet USDC sent. TX: ${txHash}`,
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Faucet request failed: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
