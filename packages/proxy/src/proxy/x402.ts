/**
 * x402 Integration Layer
 *
 * Handles:
 * - Forwarding requests to x402 servers
 * - Parsing 402 PaymentRequired responses
 * - Forwarding requests with signed payment headers
 *
 * CRITICAL: This proxy NEVER signs payments - it only relays
 */

export interface PaymentInfo {
  maxAmountRequired: string; // USDC BIGINT
  resource: string;
  scheme: string;
  network: string;
  description?: string;
  payTo?: string;
  maxTimeoutSeconds?: number;
  asset?: string;
  extra?: any;
}

export class X402Integration {
  /**
   * Forward request to target x402 server
   * Returns the raw response (may be 402 PaymentRequired)
   */
  async forwardRequest(url: string, options: RequestInit): Promise<Response> {
    try {
      const response = await fetch(url, {
        ...options,
        redirect: 'manual', // Don't auto-follow redirects
      });

      return response;
    } catch (error) {
      // Network errors, DNS failures, etc.
      throw new Error(`Failed to forward request to ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Forward request with signed payment header
   * Used after agent signs the payment
   */
  async forwardWithPayment(
    url: string,
    options: RequestInit,
    signedPayment: any,
  ): Promise<Response> {
    // Merge signed payment into headers
    const headers = new Headers(options.headers);

    // x402 payment header format (base64-encoded JSON)
    const paymentHeader = Buffer.from(JSON.stringify(signedPayment)).toString('base64');
    headers.set('X-Payment', paymentHeader);

    const updatedOptions: RequestInit = {
      ...options,
      headers,
      redirect: 'manual',
    };

    return this.forwardRequest(url, updatedOptions);
  }

  /**
   * Parse 402 PaymentRequired response
   * Extracts payment info from response headers or body
   *
   * x402 uses:
   * - Header: WWW-Authenticate: x402 <base64-json>
   * - Header: X-Payment-Required: <base64-json>
   * - Body JSON: { accepts: [{ scheme, network, maxAmountRequired, resource, ... }] }
   *
   * Returns null if response is not 402 or payment info can't be parsed
   */
  async parsePaymentRequest(response: Response): Promise<PaymentInfo | null> {
    if (response.status !== 402) {
      return null;
    }

    try {
      // Try WWW-Authenticate header first (standard x402)
      const wwwAuth = response.headers.get('WWW-Authenticate');
      if (wwwAuth) {
        const parsed = this.parseWWWAuthenticate(wwwAuth);
        if (parsed) return parsed;
      }

      // Fallback: try X-Payment-Required header
      const paymentRequired = response.headers.get('X-Payment-Required');
      if (paymentRequired) {
        const parsed = this.parseBase64PaymentInfo(paymentRequired);
        if (parsed) return parsed;
      }

      // Fallback: parse response body (real x402 protocol format)
      const body = await response.json().catch(() => null);
      if (body) {
        const parsed = this.parseX402Body(body);
        if (parsed) return parsed;
      }

      return null;
    } catch (error) {
      console.error('[X402Integration] Failed to parse 402 response:', error);
      return null;
    }
  }

  /**
   * Parse x402 body format: { accepts: [{ scheme, network, maxAmountRequired, resource, payTo, ... }] }
   */
  private parseX402Body(body: any): PaymentInfo | null {
    if (!body || !Array.isArray(body.accepts) || body.accepts.length === 0) {
      return null;
    }

    const accept = body.accepts[0];
    if (!accept.maxAmountRequired || !accept.resource || !accept.scheme || !accept.network) {
      return null;
    }

    return {
      maxAmountRequired: String(accept.maxAmountRequired),
      resource: accept.resource,
      scheme: accept.scheme,
      network: accept.network,
      description: accept.description,
      payTo: accept.payTo,
      maxTimeoutSeconds: accept.maxTimeoutSeconds ?? 60,
      asset: accept.asset,
      extra: accept.extra,
    };
  }

  /**
   * Parse WWW-Authenticate header
   * Format: "x402 <base64-encoded-json>"
   */
  private parseWWWAuthenticate(header: string): PaymentInfo | null {
    try {
      // Extract base64 part after "x402 "
      const match = header.match(/^x402\s+(.+)$/i);
      if (!match) return null;

      const base64 = match[1];
      return this.parseBase64PaymentInfo(base64);
    } catch {
      return null;
    }
  }

  /**
   * Parse base64-encoded payment info JSON
   */
  private parseBase64PaymentInfo(base64: string): PaymentInfo | null {
    try {
      const json = Buffer.from(base64, 'base64').toString('utf-8');
      const data = JSON.parse(json);

      // Validate required fields
      if (!data.maxAmountRequired || !data.resource || !data.scheme || !data.network) {
        console.warn('[X402Integration] Missing required fields in payment info:', data);
        return null;
      }

      return {
        maxAmountRequired: String(data.maxAmountRequired), // Ensure string
        resource: data.resource,
        scheme: data.scheme,
        network: data.network,
        description: data.description,
      };
    } catch (error) {
      console.error('[X402Integration] Failed to decode base64 payment info:', error);
      return null;
    }
  }
}

// Export singleton instance
export const x402Integration = new X402Integration();
