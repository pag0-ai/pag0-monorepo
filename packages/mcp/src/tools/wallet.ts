import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IWallet } from "../wallet.js";
import { Pag0Wallet } from "../wallet.js";

export function registerWalletTools(
  server: McpServer,
  wallet: IWallet,
) {
  server.tool(
    "pag0_wallet_status",
    "Check agent wallet address, token balance (USDC on Base, USDT on BSC), network, wallet mode, and Permit2 approval status (BSC only). Use this before making paid API calls to verify sufficient funds and Permit2 approval.",
    {},
    async () => {
      const status = await wallet.getStatus();
      const result: Record<string, unknown> = {
        ...status,
        walletMode: wallet.walletMode,
      };

      // Add Permit2 guidance for BSC
      if (status.permit2 && !status.permit2.approved) {
        result.permit2Warning = "Permit2 not approved! Run pag0_approve_permit2 before making x402 payments on BSC.";
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    },
  );

  // Permit2 approval tool — only for local wallets on BSC
  if (wallet instanceof Pag0Wallet) {
    server.tool(
      "pag0_approve_permit2",
      "Approve the Permit2 contract to spend USDT on BSC. Required once before x402 payments. Sends an on-chain approve() transaction (costs ~$0.01 BNB gas). After approval, all subsequent x402 payments use gasless Permit2 signatures.",
      {},
      async () => {
        try {
          const status = await wallet.getStatus();

          // Already approved?
          if (status.permit2?.approved) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify({
                    status: "already_approved",
                    allowance: status.permit2.allowance,
                    permit2Address: status.permit2.permit2Address,
                    message: "Permit2 is already approved. No action needed.",
                  }, null, 2),
                },
              ],
            };
          }

          const result = await wallet.approvePermit2();
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  status: "approved",
                  txHash: result.txHash,
                  token: result.token,
                  spender: result.spender,
                  message: "Permit2 approved! You can now make x402 payments on BSC.",
                }, null, 2),
              },
            ],
          };
        } catch (err) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Permit2 approval failed: ${err instanceof Error ? err.message : String(err)}. Make sure your wallet has BNB for gas.`,
              },
            ],
            isError: true,
          };
        }
      },
    );
  }
}
