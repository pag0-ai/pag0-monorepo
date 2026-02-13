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

export type CacheSource = 'proxy_cache' | 'passthrough';

export interface ProxyResponse {
  status: number;
  body: unknown;
  metadata: {
    cached: boolean;
    cacheSource: CacheSource;
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

export interface EndpointResource {
  path: string;
  method: string;
  description?: string;
  cost: string;
  bodySchema?: Record<string, any>;
  queryParams?: Record<string, any>;
  headerFields?: Record<string, any>;
  outputSchema?: Record<string, any>;
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
  weights?: {
    cost: number;
    latency: number;
    reliability: number;
    reputation: number;
  };
  evidence?: {
    sampleSize: number;
    period: string;
    avgCostPerRequest: string;
    avgLatencyMs: number;
    successRate: number;
  };
  resources?: EndpointResource[];
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
