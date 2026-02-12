import { Wallet, JsonRpcProvider, Contract, formatUnits } from "ethers";

// ERC-20 minimal ABI for balance check
const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
];

// Circle USDC addresses per network
const USDC_ADDRESSES: Record<string, string> = {
  "base-sepolia": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  "base": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
};

const RPC_URLS: Record<string, string> = {
  "base-sepolia": "https://sepolia.base.org",
  "base": "https://mainnet.base.org",
};

export interface WalletStatus {
  address: string;
  balanceUSDC: string;
  balanceFormatted: string;
  network: string;
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
    const usdcAddress = USDC_ADDRESSES[this.network];
    if (!usdcAddress) throw new Error(`No USDC contract on ${this.network}`);

    const usdc = new Contract(usdcAddress, ERC20_ABI, this.provider);
    const balance: bigint = await usdc.balanceOf(this.wallet.address);

    return {
      address: this.wallet.address,
      balanceUSDC: balance.toString(),
      balanceFormatted: formatUnits(balance, 6),
      network: this.network,
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
