/**
 * x402 Payment Integration
 *
 * Creates x402 PaymentPayload from payment requirements returned by the proxy.
 * The MCP never calls x402 servers directly — it always goes through the proxy.
 *
 * Flow: MCP → Proxy → 402 + paymentInfo → MCP signs → MCP → Proxy (with signedPayment) → x402 → 200
 */
import { ExactEvmSchemeV1 } from "@x402/evm/v1";
import type { IWallet } from "./wallet.js";

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
  extra?: { name?: string; version?: string; [k: string]: unknown };
}

/**
 * Create an x402 PaymentPayload from the proxy's 402 paymentInfo.
 * Uses ExactEvmSchemeV1 to sign an EIP-3009 transferWithAuthorization.
 *
 * The returned payload is passed back to the proxy as `signedPayment`,
 * which base64-encodes it as the X-Payment header for the x402 server.
 */
export async function createPaymentPayload(
  wallet: IWallet,
  paymentInfo: ProxyPaymentInfo,
): Promise<Record<string, unknown>> {
  const signer = wallet.getEvmSigner();
  const scheme = new ExactEvmSchemeV1(signer);

  // Build PaymentRequirementsV1 from the proxy's paymentInfo
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
