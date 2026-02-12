// === USDC: Always BIGINT 6 decimals (1 USDC = 1_000_000) ===
export type UsdcAmount = string; // BIGINT as string, NEVER floating point

// === Core Types ===

export interface ProxyRequest {
  targetUrl: string;
  method: string;
  headers?: Record<string, string>;
  body?: unknown;
  projectId: string;
}

export interface ProxyResponse {
  status: number;
  body: unknown;
  metadata: {
    cached: boolean;
    cost: UsdcAmount;
    latencyMs: number;
    policyApplied: string | null;
  };
}

export interface Policy {
  id: string;
  projectId: string;
  name: string;
  maxPerRequest: UsdcAmount;
  dailyBudget: UsdcAmount;
  monthlyBudget: UsdcAmount;
  allowedEndpoints: string[];
  blockedEndpoints: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface EndpointScore {
  endpoint: string;
  category: string;
  overallScore: number;
  costScore: number;
  latencyScore: number;
  reliabilityScore: number;
  reputationScore?: number;  // On-chain reputation score (0-100)
  sampleSize: number;
  lastCalculated: Date;
}

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  apiKeyHash: string; // SHA-256
  tier: 'free' | 'pro' | 'enterprise';
  createdAt: Date;
}

// === Error Types ===

export class PolicyViolationError extends Error {
  constructor(
    message: string,
    public code: string = 'POLICY_VIOLATION',
  ) {
    super(message);
    this.name = 'PolicyViolationError';
  }
}

export class UnauthorizedError extends Error {
  constructor(message: string = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class RateLimitError extends Error {
  constructor(
    message: string = 'Rate limit exceeded',
    public retryAfter: number = 60,
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}
