/**
 * Custom BSC Permit2 Scheme for x402 client
 *
 * The x402 SDK's ExactEvmScheme hardcodes spender = x402ExactPermit2ProxyAddress
 * (0x4020615294c913F045dc10f0a5cdEbd86c280001). That contract doesn't exist on BSC,
 * and our local facilitator settles via a relayer wallet calling Permit2 directly.
 * Permit2 enforces msg.sender == spender, so the signature must use the relayer address.
 *
 * This scheme reads `extra.spender` from the 402 payment requirements (set by
 * x402-bsc middleware) and uses it as the Permit2 spender, enabling real on-chain settlement.
 */

import type { EvmSigner } from './wallet.js';

const PERMIT2_ADDRESS = '0x000000000022D473030F116dDEE9F6B43aC78BA3';

const permit2WitnessTypes = {
  PermitWitnessTransferFrom: [
    { name: 'permitted', type: 'TokenPermissions' },
    { name: 'spender', type: 'address' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
    { name: 'witness', type: 'Witness' },
  ],
  TokenPermissions: [
    { name: 'token', type: 'address' },
    { name: 'amount', type: 'uint256' },
  ],
  Witness: [
    { name: 'to', type: 'address' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'extra', type: 'bytes' },
  ],
};

function createPermit2Nonce(): string {
  const randomBytes = crypto.getRandomValues(new Uint8Array(32));
  const hex = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return BigInt('0x' + hex).toString();
}

/**
 * x402 client scheme for BSC Permit2 payments.
 * Compatible with x402Client.register("eip155:56", scheme).
 */
export class BscPermit2Scheme {
  readonly scheme = 'exact' as const;
  private signer: EvmSigner;

  constructor(signer: EvmSigner) {
    this.signer = signer;
  }

  async createPaymentPayload(x402Version: number, paymentRequirements: any) {
    const now = Math.floor(Date.now() / 1000);
    const nonce = createPermit2Nonce();
    const validAfter = (now - 600).toString();
    const deadline = (now + (paymentRequirements.maxTimeoutSeconds || 3600)).toString();

    // KEY FIX: use extra.spender (our relayer) instead of SDK's hardcoded x402 proxy
    const spender = paymentRequirements.extra?.spender;
    if (!spender) {
      throw new Error(
        'BSC Permit2 requires extra.spender in payment requirements (relayer address)',
      );
    }

    const permit2Authorization = {
      from: this.signer.address,
      permitted: {
        token: paymentRequirements.asset,
        amount: paymentRequirements.amount,
      },
      spender,
      nonce,
      deadline,
      witness: {
        to: paymentRequirements.payTo,
        validAfter,
        extra: '0x',
      },
    };

    const chainId = parseInt(paymentRequirements.network.split(':')[1]);

    const signature = await this.signer.signTypedData({
      domain: {
        name: 'Permit2',
        chainId,
        verifyingContract: PERMIT2_ADDRESS,
      },
      types: permit2WitnessTypes,
      primaryType: 'PermitWitnessTransferFrom',
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

    return {
      x402Version,
      payload: {
        signature,
        permit2Authorization,
      },
    };
  }
}
