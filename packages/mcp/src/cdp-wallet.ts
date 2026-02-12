import { CdpClient } from "@coinbase/cdp-sdk";
import type { WalletStatus, SignedPayment, IWallet } from "./wallet.js";

type FaucetNetwork = "base-sepolia" | "ethereum-sepolia";

const ACCOUNT_NAME = "pag0-mcp-demo-wallet";

export class CdpWallet implements IWallet {
  readonly walletMode = "cdp";
  private cdp: CdpClient;
  private account: { address: string } | null = null;
  private _network: string;

  constructor(network = "base-sepolia") {
    if (!process.env.CDP_API_KEY_ID) {
      throw new Error("Missing CDP_API_KEY_ID env var");
    }
    if (!process.env.CDP_API_KEY_SECRET) {
      throw new Error("Missing CDP_API_KEY_SECRET env var");
    }
    if (!process.env.CDP_WALLET_SECRET) {
      throw new Error("Missing CDP_WALLET_SECRET env var");
    }
    this.cdp = new CdpClient({
      apiKeyId: process.env.CDP_API_KEY_ID,
      apiKeySecret: process.env.CDP_API_KEY_SECRET,
      walletSecret: process.env.CDP_WALLET_SECRET,
    });
    this._network = network;
  }

  get address(): string {
    return this.account?.address ?? "not-initialized";
  }

  /** Create or load EVM account (lazy init) */
  async init(): Promise<void> {
    if (!this.account) {
      try {
        const account = await this.cdp.evm.getAccount({ name: ACCOUNT_NAME });
        this.account = account;
      } catch {
        this.account = await this.cdp.evm.createAccount({ name: ACCOUNT_NAME });
      }
    }

    if (this._network === "base-sepolia") {
      const balances = await this.cdp.evm.listTokenBalances({
        address: this.account.address as `0x${string}`,
        // Cast: CDP SDK expects a specific union but our _network aligns with valid values
        network: this._network as "base-sepolia",
      });

      const ethBalance = balances.balances.find(
        (b) => b.token.symbol?.toLowerCase() === "eth",
      );
      const usdcBalance = balances.balances.find(
        (b) => b.token.symbol?.toLowerCase() === "usdc",
      );

      // Faucet eth balance
      if (!ethBalance || ethBalance.amount.amount === 0n) {
        await this.cdp.evm
          .requestFaucet({
            address: this.account.address as `0x${string}`,
            network: this._network as FaucetNetwork,
            token: "eth",
          })
          .then((res) => {
            console.log(
              `Requested funds from ETH faucet: https://sepolia.basescan.org/tx/${res.transactionHash}`,
            );
          })
          .catch((error) => {
            console.warn("Faucet ETH request failed:", error);
          });
      }

      // Faucet USDC balance
      if (!usdcBalance || usdcBalance.amount.amount === 0n) {
        await this.cdp.evm
          .requestFaucet({
            address: this.account.address as `0x${string}`,
            network: this._network as FaucetNetwork,
            token: "usdc",
          })
          .then((res) => {
            console.log(
              `Requested funds from USDC faucet: https://sepolia.basescan.org/tx/${res.transactionHash}`,
            );
          })
          .catch((error) => {
            console.warn("Faucet USDC request failed:", error);
          });
      }
    }
  }

  async getStatus(): Promise<WalletStatus> {
    await this.init();
    const addr = this.account!.address as `0x${string}`;
    const balances = await this.cdp.evm.listTokenBalances({
      address: addr,
      // Cast: CDP SDK expects a specific union but our _network aligns with valid values
      network: this._network as "base-sepolia",
    });
    const usdc = balances.balances.find((b) => b.token.symbol === "USDC");
    const raw = usdc ? String(usdc.amount.amount) : "0";
    const formatted = (Number(raw) / 1_000_000).toFixed(2);
    return {
      address: this.account!.address,
      balanceUSDC: raw,
      balanceFormatted: formatted,
      network: this._network,
    };
  }

  async signPayment(paymentRequest: {
    id: string;
    amount: string;
    recipient: string;
  }): Promise<SignedPayment> {
    await this.init();
    const timestamp = Math.floor(Date.now() / 1000);
    const message = JSON.stringify({
      id: paymentRequest.id,
      amount: paymentRequest.amount,
      recipient: paymentRequest.recipient,
      timestamp,
    });
    // Sign using CDP Server Wallet (EIP-191)
    const result = await this.cdp.evm.signMessage({
      address: this.account!.address as `0x${string}`,
      message,
    });
    return {
      id: paymentRequest.id,
      amount: paymentRequest.amount,
      signature: result.signature,
      timestamp,
    };
  }

  getEvmSigner(): import("./wallet.js").EvmSigner {
    if (!this.account) {
      throw new Error("CdpWallet not initialized — call init() first");
    }
    const cdp = this.cdp;
    const address = this.account.address as `0x${string}`;
    return {
      address,
      async signTypedData(msg) {
        const result = await cdp.evm.signTypedData({
          address,
          domain: msg.domain as any,
          types: msg.types as any,
          primaryType: msg.primaryType as any,
          message: msg.message as any,
        });
        return result.signature as `0x${string}`;
      },
    };
  }

  /** Request testnet USDC from faucet (Base Sepolia only) */
  async requestFaucet(): Promise<string> {
    await this.init();
    const result = await this.cdp.evm.requestFaucet({
      address: this.account!.address as `0x${string}`,
      network: this._network as FaucetNetwork,
      token: "usdc",
    });
    return result.transactionHash;
  }
}
