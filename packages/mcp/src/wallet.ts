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

export class Pag0Wallet {
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
}
