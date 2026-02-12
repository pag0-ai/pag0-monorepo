/**
 * ERC-8004 Audit Trail Integration
 *
 * Records on-chain audit feedback to ReputationRegistry after x402 payments.
 * Uploads proof-of-payment metadata to IPFS, then calls giveFeedback().
 * Runs fire-and-forget in the post-processing pipeline — never blocks responses.
 */

import { ethers } from 'ethers';
import ReputationRegistryABI from './abi/ReputationRegistry.json';
import ValidationRegistryABI from './abi/ValidationRegistry.json';

// ─── Types ──────────────────────────────────────────────────────────

export interface AuditFeedbackParams {
  agentId: string;       // x402 server's ERC-8004 identity
  endpoint: string;
  cost: string;          // USDC BIGINT string
  latencyMs: number;
  statusCode: number;
  txHash: string;        // x402 payment transaction hash
  sender: string;        // payer wallet address
  receiver: string;      // x402 server address
}

export interface ValidationParams {
  agentId: string;
  endpoint: string;
  estimatedCost: string;
  taskDescription: string;
}

interface FeedbackMetadata {
  version: string;
  type: string;
  proofOfPayment: {
    txHash: string;
    sender: string;
    receiver: string;
    amount: string;
    network: string;
  };
  serviceMetrics: {
    endpoint: string;
    latencyMs: number;
    statusCode: number;
    timestamp: number;
  };
}

// ─── Retry Queue (in-memory, fire-and-forget) ───────────────────────

interface QueuedFeedback {
  params: AuditFeedbackParams;
  retries: number;
  nextRetryAt: number;
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 30_000; // 30s between retries

// ─── Class ──────────────────────────────────────────────────────────

export class ERC8004AuditTrail {
  private reputationRegistry: ethers.Contract | null = null;
  private validationRegistry: ethers.Contract | null = null;
  private enabled: boolean;
  private network: string;
  private ipfsUrl: string;
  private retryQueue: QueuedFeedback[] = [];
  private retryTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.enabled = process.env.ERC8004_ENABLED !== 'false';
    this.network = process.env.X402_NETWORK || 'base';
    this.ipfsUrl = process.env.IPFS_API_URL || 'https://ipfs.infura.io:5001';

    if (!this.enabled) {
      console.log('[ERC-8004] Audit trail disabled (ERC8004_ENABLED=false)');
      return;
    }

    const signerKey = process.env.ERC8004_SIGNER_KEY;
    const reputationAddr = process.env.ERC8004_REPUTATION_REGISTRY;
    const validationAddr = process.env.ERC8004_VALIDATION_REGISTRY;
    const rpcUrl = process.env.SKALE_RPC_URL;

    if (!signerKey || !reputationAddr || !rpcUrl) {
      console.warn('[ERC-8004] Missing required env vars (ERC8004_SIGNER_KEY, ERC8004_REPUTATION_REGISTRY, SKALE_RPC_URL). Disabling.');
      this.enabled = false;
      return;
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const signer = new ethers.Wallet(signerKey, provider);

    this.reputationRegistry = new ethers.Contract(
      reputationAddr,
      ReputationRegistryABI,
      signer,
    );

    if (validationAddr) {
      this.validationRegistry = new ethers.Contract(
        validationAddr,
        ValidationRegistryABI,
        signer,
      );
    }

    // Start retry processor
    this.retryTimer = setInterval(() => this.processRetryQueue(), RETRY_DELAY_MS);

    console.log(`[ERC-8004] Audit trail enabled (reputation=${reputationAddr})`);
  }

  /**
   * Record payment feedback on-chain after successful x402 payment.
   * 1. Build metadata JSON
   * 2. Upload to IPFS (fallback: empty URI)
   * 3. Call ReputationRegistry.giveFeedback()
   */
  async recordPaymentFeedback(params: AuditFeedbackParams): Promise<string | null> {
    if (!this.enabled || !this.reputationRegistry) {
      return null;
    }

    try {
      // 1. Build feedback metadata
      const feedbackData = this.buildFeedbackMetadata(params);

      // 2. Upload to IPFS (with fallback)
      let feedbackURI = '';
      try {
        feedbackURI = await this.uploadToIPFS(feedbackData);
      } catch (err) {
        console.warn('[ERC-8004] IPFS upload failed, proceeding with empty URI:', err);
      }

      // 3. Compute integrity hash
      const feedbackHash = ethers.keccak256(
        ethers.toUtf8Bytes(JSON.stringify(feedbackData)),
      );

      // 4. Calculate quality score
      const qualityScore = this.calculateQualityScore(params.latencyMs, params.statusCode);

      // 5. Call giveFeedback on-chain
      const tx = await this.reputationRegistry.giveFeedback(
        params.agentId,
        qualityScore,
        2, // valueDecimals
        ethers.encodeBytes32String('x402-payment'),
        ethers.encodeBytes32String('api-call'),
        feedbackURI,
        feedbackHash,
      );

      await tx.wait();
      console.log(`[ERC-8004] Feedback recorded: tx=${tx.hash} score=${qualityScore}`);
      return tx.hash;
    } catch (err) {
      console.warn('[ERC-8004] On-chain feedback failed, queuing for retry:', err);
      this.enqueueRetry(params);
      return null;
    }
  }

  /**
   * Request pre-validation for high-cost transactions via ValidationRegistry.
   */
  async requestValidation(params: ValidationParams): Promise<string | null> {
    if (!this.enabled || !this.validationRegistry) {
      return null;
    }

    try {
      const tx = await this.validationRegistry.validationRequest(
        params.agentId,
        ethers.toUtf8Bytes(JSON.stringify({
          endpoint: params.endpoint,
          estimatedCost: params.estimatedCost,
          task: params.taskDescription,
          timestamp: Date.now(),
        })),
      );

      await tx.wait();
      console.log(`[ERC-8004] Validation requested: tx=${tx.hash}`);
      return tx.hash;
    } catch (err) {
      console.warn('[ERC-8004] Validation request failed:', err);
      return null;
    }
  }

  /**
   * Quality score based on latency + status code.
   *
   * | Condition              | Score |
   * |------------------------|-------|
   * | 2xx + latency < 200ms  | 100   |
   * | 2xx + latency < 500ms  | 85    |
   * | 2xx + latency < 1000ms | 70    |
   * | 2xx + latency < 3000ms | 50    |
   * | 2xx + latency >= 3000ms| 30    |
   * | non-2xx                | 10    |
   */
  calculateQualityScore(latencyMs: number, statusCode: number): number {
    if (statusCode >= 200 && statusCode < 300) {
      if (latencyMs < 200) return 100;
      if (latencyMs < 500) return 85;
      if (latencyMs < 1000) return 70;
      if (latencyMs < 3000) return 50;
      return 30;
    }
    return 10;
  }

  // ─── Private Helpers ────────────────────────────────────────────

  private buildFeedbackMetadata(params: AuditFeedbackParams): FeedbackMetadata {
    return {
      version: '1.0',
      type: 'x402-payment-audit',
      proofOfPayment: {
        txHash: params.txHash,
        sender: params.sender,
        receiver: params.receiver,
        amount: params.cost,
        network: this.network,
      },
      serviceMetrics: {
        endpoint: params.endpoint,
        latencyMs: params.latencyMs,
        statusCode: params.statusCode,
        timestamp: Date.now(),
      },
    };
  }

  /**
   * Upload JSON metadata to IPFS via HTTP API.
   * Uses the /api/v0/add endpoint (Infura/Kubo compatible).
   */
  private async uploadToIPFS(data: FeedbackMetadata): Promise<string> {
    const body = JSON.stringify(data);
    const formData = new FormData();
    formData.append('file', new Blob([body], { type: 'application/json' }));

    const response = await fetch(`${this.ipfsUrl}/api/v0/add`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`IPFS upload failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json() as { Hash: string };
    return `ipfs://${result.Hash}`;
  }

  // ─── Retry Queue ────────────────────────────────────────────────

  private enqueueRetry(params: AuditFeedbackParams): void {
    if (this.retryQueue.length >= 100) {
      // Drop oldest to prevent unbounded growth
      this.retryQueue.shift();
    }

    this.retryQueue.push({
      params,
      retries: 0,
      nextRetryAt: Date.now() + RETRY_DELAY_MS,
    });
  }

  private async processRetryQueue(): Promise<void> {
    const now = Date.now();
    const ready = this.retryQueue.filter((item) => item.nextRetryAt <= now);

    for (const item of ready) {
      try {
        await this.recordPaymentFeedback(item.params);
        // Success — remove from queue
        const idx = this.retryQueue.indexOf(item);
        if (idx !== -1) this.retryQueue.splice(idx, 1);
      } catch {
        item.retries++;
        if (item.retries >= MAX_RETRIES) {
          console.error('[ERC-8004] Max retries exceeded, dropping feedback:', item.params.txHash);
          const idx = this.retryQueue.indexOf(item);
          if (idx !== -1) this.retryQueue.splice(idx, 1);
        } else {
          item.nextRetryAt = now + RETRY_DELAY_MS * (item.retries + 1);
        }
      }
    }
  }

  /** Cleanup for graceful shutdown */
  shutdown(): void {
    if (this.retryTimer) {
      clearInterval(this.retryTimer);
      this.retryTimer = null;
    }
  }
}

// Export singleton
export const erc8004Audit = new ERC8004AuditTrail();
