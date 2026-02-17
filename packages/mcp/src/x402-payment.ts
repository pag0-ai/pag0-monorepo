/**
 * x402 Payment Integration
 *
 * Creates x402 PaymentPayload from payment requirements returned by the proxy.
 * The MCP never calls x402 servers directly — it always goes through the proxy.
 *
 * Flow: MCP → Proxy → 402 + paymentInfo → MCP signs → MCP → Proxy (with signedPayment) → x402 → 200
 */
import { ExactEvmSchemeV1 } from "@x402/evm/v1";
import { ExactEvmScheme } from "@x402/evm";
import type { IWallet } from "./wallet.js";

/** Networks that use V2 ExactEvmScheme instead of V1 */
const V2_NETWORKS = new Set(["eip155:56", "bsc"]);

const PERMIT2_ADDRESS = "0x000000000022D473030F116dDEE9F6B43aC78BA3";

/** Permit2 EIP-712 types for signing */
const permit2WitnessTypes = {
  PermitWitnessTransferFrom: [
    { name: "permitted", type: "TokenPermissions" },
    { name: "spender", type: "address" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
    { name: "witness", type: "Witness" },
  ],
  TokenPermissions: [
    { name: "token", type: "address" },
    { name: "amount", type: "uint256" },
  ],
  Witness: [
    { name: "to", type: "address" },
    { name: "validAfter", type: "uint256" },
    { name: "extra", type: "bytes" },
  ],
};

/** Payment requirements returned by the proxy on 402 */
export interface ProxyPaymentInfo {
  maxAmountRequired: string;
  resource: string;
  scheme: string;
  network: string;
  description?: string;
  payTo?: string;
  maxTimeoutSeconds?: number;
  asset?: string;
  extra?: { name?: string; version?: string; spender?: string; assetTransferMethod?: string; [k: string]: unknown };
}

/**
 * Create a manual Permit2 payload with a custom spender (our relayer).
 * The SDK's ExactEvmScheme hardcodes spender to x402ExactPermit2ProxyAddress,
 * so we create the payload ourselves when extra.spender is provided.
 */
async function createPermit2PayloadManual(
  wallet: IWallet,
  paymentInfo: ProxyPaymentInfo,
  spender: string,
): Promise<Record<string, unknown>> {
  const signer = wallet.getEvmSigner();
  const chainId = paymentInfo.network === "eip155:56" ? 56 : 1;

  // Random nonce (same approach as SDK)
  const nonce = BigInt(`0x${Array.from({ length: 32 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, "0")).join("")}`).toString();
  const deadline = (Math.floor(Date.now() / 1000) + (paymentInfo.maxTimeoutSeconds ?? 60)).toString();

  const permit2Authorization = {
    permitted: {
      token: paymentInfo.asset || "",
      amount: paymentInfo.maxAmountRequired,
    },
    spender,
    nonce,
    deadline,
    witness: {
      to: paymentInfo.payTo || "",
      validAfter: "0",
      extra: "0x",
    },
    from: signer.address,
  };

  // Sign via EIP-712
  const domain = {
    name: "Permit2",
    chainId,
    verifyingContract: PERMIT2_ADDRESS,
  };

  const signature = await signer.signTypedData({
    domain,
    types: permit2WitnessTypes,
    primaryType: "PermitWitnessTransferFrom",
    message: {
      permitted: {
        token: permit2Authorization.permitted.token,
        amount: BigInt(permit2Authorization.permitted.amount),
      },
      spender: permit2Authorization.spender,
      nonce: BigInt(permit2Authorization.nonce),
      deadline: BigInt(permit2Authorization.deadline),
      witness: {
        to: permit2Authorization.witness.to,
        validAfter: BigInt(permit2Authorization.witness.validAfter),
        extra: permit2Authorization.witness.extra,
      },
    },
  });

  const requirements = {
    scheme: paymentInfo.scheme || "exact",
    network: paymentInfo.network,
    amount: paymentInfo.maxAmountRequired,
    payTo: paymentInfo.payTo || "",
    maxTimeoutSeconds: paymentInfo.maxTimeoutSeconds ?? 60,
    asset: paymentInfo.asset || "",
    extra: paymentInfo.extra || {},
  };

  return {
    x402Version: 2,
    scheme: "exact",
    network: paymentInfo.network,
    payload: {
      signature,
      permit2Authorization,
    },
    accepted: requirements,
    resource: { url: paymentInfo.resource || "" },
  };
}

/**
 * Create an x402 PaymentPayload from the proxy's 402 paymentInfo.
 *
 * - V2 + extra.spender: manual Permit2 payload with our relayer as spender
 * - V2 (no spender): SDK's ExactEvmScheme (uses x402ExactPermit2ProxyAddress)
 * - V1: ExactEvmSchemeV1 (EIP-3009 transferWithAuthorization)
 */
export async function createPaymentPayload(
  wallet: IWallet,
  paymentInfo: ProxyPaymentInfo,
): Promise<Record<string, unknown>> {
  const signer = wallet.getEvmSigner();
  const isV2 = V2_NETWORKS.has(paymentInfo.network);

  if (isV2) {
    const customSpender = paymentInfo.extra?.spender;

    if (customSpender) {
      // Manual Permit2 payload with our relayer as spender
      // (SDK hardcodes x402ExactPermit2ProxyAddress which won't work for local settlement)
      return createPermit2PayloadManual(wallet, paymentInfo, customSpender);
    }

    // Fallback: SDK's ExactEvmScheme (uses x402 proxy contract as spender)
    const scheme = new ExactEvmScheme(signer);
    const requirements = {
      scheme: paymentInfo.scheme || "exact",
      network: paymentInfo.network,
      amount: paymentInfo.maxAmountRequired,
      payTo: paymentInfo.payTo || "",
      maxTimeoutSeconds: paymentInfo.maxTimeoutSeconds ?? 60,
      asset: paymentInfo.asset || "",
      extra: paymentInfo.extra || {},
    };
    const partialPayload = await scheme.createPaymentPayload(2, requirements as any);
    return {
      ...partialPayload,
      accepted: requirements,
      resource: { url: paymentInfo.resource || "" },
    } as unknown as Record<string, unknown>;
  }

  // V1 scheme for Base networks — uses ExactEvmSchemeV1 (EIP-3009)
  const scheme = new ExactEvmSchemeV1(signer);
  const requirements = {
    scheme: paymentInfo.scheme || "exact",
    network: paymentInfo.network,
    maxAmountRequired: paymentInfo.maxAmountRequired,
    resource: paymentInfo.resource,
    description: paymentInfo.description || "",
    mimeType: "",
    outputSchema: {},
    payTo: paymentInfo.payTo || "",
    maxTimeoutSeconds: paymentInfo.maxTimeoutSeconds ?? 60,
    asset: paymentInfo.asset || "",
    extra: paymentInfo.extra || {},
  };
  const payload = await scheme.createPaymentPayload(1, requirements as any);
  return payload as unknown as Record<string, unknown>;
}

/**
 * Parse payment receipt from proxy response headers or body.
 * Returns settlement info (tx hash, success) or null.
 */
export function parsePaymentReceipt(
  body: Record<string, unknown>,
): { success: boolean; txHash?: string; network?: string } | null {
  // The proxy response body may include payment headers forwarded from x402
  const headers = body.headers as Record<string, string> | undefined;
  if (!headers) return null;

  const header = headers["payment-response"] || headers["x-payment-response"];
  if (!header) return null;

  try {
    const data = JSON.parse(Buffer.from(header, "base64").toString());
    return {
      success: data.success ?? true,
      txHash: data.transaction?.hash || data.txHash,
      network: data.network,
    };
  } catch {
    return null;
  }
}
