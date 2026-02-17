import { Wallet, JsonRpcProvider, Contract, formatUnits } from "ethers";

// ERC-20 minimal ABI for balance check + Permit2 approval
const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
];

const PERMIT2_ADDRESS = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
const MAX_UINT256 = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

// Circle USDC addresses per network
// Token addresses (USDC on Base, USDT on BSC)
const TOKEN_ADDRESSES: Record<string, string> = {
  "base-sepolia": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  "base": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "bsc": "0x55d398326f99059fF775485246999027B3197955",
};

const RPC_URLS: Record<string, string> = {
  "base-sepolia": "https://sepolia.base.org",
  "base": "https://mainnet.base.org",
  "bsc": "https://bsc-dataseed.binance.org",
};

export interface Permit2Status {
  approved: boolean;
  allowance: string;
  permit2Address: string;
}

export interface WalletStatus {
  address: string;
  balanceUSDC: string;
  balanceFormatted: string;
  network: string;
  permit2?: Permit2Status;
}

export interface SignedPayment {
  id: string;
  amount: string;
  signature: string;
  timestamp: number;
}

/** EVM signer compatible with @x402/evm ClientEvmSigner */
export interface EvmSigner {
  readonly address: `0x${string}`;
  signTypedData(message: {
    domain: Record<string, unknown>;
    types: Record<string, unknown>;
    primaryType: string;
    message: Record<string, unknown>;
  }): Promise<`0x${string}`>;
}

/** Common wallet interface implemented by both LocalWallet (Pag0Wallet) and CdpWallet */
export interface IWallet {
  readonly address: string;
  readonly walletMode: string;
  getStatus(): Promise<WalletStatus>;
  signPayment(paymentRequest: {
    id: string;
    amount: string;
    recipient: string;
  }): Promise<SignedPayment>;
  /** Get an EVM signer for x402 payment authorization (EIP-3009/EIP-712) */
  getEvmSigner(): EvmSigner;
}

export class Pag0Wallet implements IWallet {
  readonly walletMode = "local";
  private wallet: Wallet;
  private provider: JsonRpcProvider;
  private network: string;

  constructor(privateKey: string, network = "base-sepolia") {
    const rpcUrl = RPC_URLS[network];
    if (!rpcUrl) throw new Error(`Unsupported network: ${network}`);

    this.network = network;
    this.provider = new JsonRpcProvider(rpcUrl);
    this.wallet = new Wallet(privateKey, this.provider);
  }

  get address(): string {
    return this.wallet.address;
  }

  async getStatus(): Promise<WalletStatus> {
    const tokenAddress = TOKEN_ADDRESSES[this.network];
    if (!tokenAddress) throw new Error(`No token contract on ${this.network}`);

    const token = new Contract(tokenAddress, ERC20_ABI, this.provider);
    const balance: bigint = await token.balanceOf(this.wallet.address);
    const decimals = this.network === "bsc" ? 18 : 6;
    const symbol = this.network === "bsc" ? "USDT" : "USDC";

    const status: WalletStatus = {
      address: this.wallet.address,
      balanceUSDC: balance.toString(),
      balanceFormatted: `${formatUnits(balance, decimals)} ${symbol}`,
      network: this.network,
    };

    // Check Permit2 allowance for BSC (Permit2 is required for BSC USDT)
    if (this.network === "bsc") {
      try {
        const allowance: bigint = await token.allowance(this.wallet.address, PERMIT2_ADDRESS);
        status.permit2 = {
          approved: allowance > 0n,
          allowance: allowance.toString(),
          permit2Address: PERMIT2_ADDRESS,
        };
      } catch {
        // Permit2 check failed — non-critical
      }
    }

    return status;
  }

  /**
   * Approve Permit2 contract to spend tokens (required once for BSC USDT).
   * Sets max allowance so subsequent x402 payments don't need additional approvals.
   * Returns the tx hash.
   */
  async approvePermit2(): Promise<{ txHash: string; token: string; spender: string }> {
    const tokenAddress = TOKEN_ADDRESSES[this.network];
    if (!tokenAddress) throw new Error(`No token contract on ${this.network}`);

    const token = new Contract(tokenAddress, ERC20_ABI, this.wallet);
    const tx = await token.approve(PERMIT2_ADDRESS, MAX_UINT256);
    const receipt = await tx.wait();

    return {
      txHash: receipt.hash,
      token: tokenAddress,
      spender: PERMIT2_ADDRESS,
    };
  }

  async signPayment(paymentRequest: {
    id: string;
    amount: string;
    recipient: string;
  }): Promise<SignedPayment> {
    const timestamp = Math.floor(Date.now() / 1000);
    // Sign a structured message containing payment details
    const message = JSON.stringify({
      id: paymentRequest.id,
      amount: paymentRequest.amount,
      recipient: paymentRequest.recipient,
      timestamp,
    });
    const signature = await this.wallet.signMessage(message);

    return {
      id: paymentRequest.id,
      amount: paymentRequest.amount,
      signature,
      timestamp,
    };
  }

  getEvmSigner(): EvmSigner {
    const wallet = this.wallet;
    return {
      address: wallet.address as `0x${string}`,
      async signTypedData(msg) {
        // ethers v6: signTypedData(domain, types, value)
        // types must NOT include EIP712Domain
        const types = { ...msg.types };
        delete types["EIP712Domain"];
        const sig = await wallet.signTypedData(
          msg.domain as any,
          types as Record<string, Array<{ name: string; type: string }>>,
          msg.message as Record<string, any>,
        );
        return sig as `0x${string}`;
      },
    };
  }
}
