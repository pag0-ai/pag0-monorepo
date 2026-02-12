import { useSession, signOut } from 'next-auth/react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
const REQUEST_TIMEOUT_MS = 15_000;

// Hook for client components to get the API key from session
export function useApiKey(): string {
  const { data: session } = useSession();
  return session?.apiKey || '';
}

// Server-side or manual fetchApi with explicit API key
export async function fetchApi<T>(path: string, options?: RequestInit & { apiKey?: string }): Promise<T> {
  const apiKey = options?.apiKey || '';
  const { apiKey: _, ...restOptions } = options || {};

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(apiKey && { 'X-Pag0-API-Key': apiKey }),
    ...(restOptions?.headers as Record<string, string>),
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...restOptions,
      headers,
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timeout);
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Request timed out. Check that the proxy server is reachable.');
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      if (typeof window !== 'undefined') {
        signOut({ callbackUrl: '/login' });
      }
      throw new Error('Session expired. Redirecting to login...');
    }
    if (res.status === 429) {
      throw new Error('Rate limited. Please wait a moment and try again.');
    }
    const error = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(error.error?.message ?? `API error: ${res.status}`);
  }

  // Handle 204 No Content (e.g. DELETE responses)
  if (res.status === 204) {
    return undefined as T;
  }

  return res.json();
}

// Helper to create a fetchApi bound to a specific API key (for use with react-query)
export function createApiFetcher(apiKey: string) {
  return <T>(path: string, options?: RequestInit) =>
    fetchApi<T>(path, { ...options, apiKey });
}

// ============================================================
// Analytics APIs
// ============================================================

export interface AnalyticsSummary {
  period: string;
  totalRequests: number;
  cacheHitRate: number;
  avgLatency: number;
  successRate: number;
  totalCost: string;
  cacheSavings: string;
  topEndpoints: Array<{ endpoint: string; requestCount: number; cost: string }>;
  budgetUsage: {
    daily: { limit: string; spent: string; remaining: string; percentage: number };
    monthly: { limit: string; spent: string; remaining: string; percentage: number };
  };
}

export async function fetchAnalyticsSummary(period: string = '7d', apiKey?: string): Promise<AnalyticsSummary> {
  return fetchApi(`/api/analytics/summary?period=${period}`, { apiKey });
}

export interface EndpointMetrics {
  endpoint: string;
  requestCount: number;
  cacheHitCount: number;
  cacheHitRate: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  successRate: number;
  errorCount: number;
  totalCost: string;
  cacheSavings: string;
}

export async function fetchAnalyticsEndpoints(params?: {
  period?: string;
  limit?: number;
  apiKey?: string;
}): Promise<EndpointMetrics[]> {
  const query = new URLSearchParams();
  if (params?.period) query.set('period', params.period);
  if (params?.limit) query.set('limit', params.limit.toString());
  const res = await fetchApi<{ endpoints: EndpointMetrics[] }>(`/api/analytics/endpoints?${query}`, { apiKey: params?.apiKey });
  return res.endpoints;
}

export interface CostDataPoint {
  timestamp: string;
  spent: string;
  saved: string;
  requestCount: number;
}

export async function fetchAnalyticsCosts(params?: {
  period?: string;
  granularity?: string;
  apiKey?: string;
}): Promise<CostDataPoint[]> {
  const query = new URLSearchParams();
  if (params?.period) query.set('period', params.period);
  if (params?.granularity) query.set('granularity', params.granularity);
  const res = await fetchApi<{ timeseries: CostDataPoint[] }>(`/api/analytics/costs?${query}`, { apiKey: params?.apiKey });
  return res.timeseries;
}

export interface CacheStats {
  hitCount: number;
  missCount: number;
  hitRate: number;
  totalSavings: string;
  topCachedEndpoints: Array<{ endpoint: string; cacheHits: number }>;
}

export async function fetchAnalyticsCache(period: string = '7d', apiKey?: string): Promise<CacheStats> {
  return fetchApi(`/api/analytics/cache?period=${period}`, { apiKey });
}

// ============================================================
// Policy APIs
// ============================================================

export interface Policy {
  id: string;
  projectId: string;
  name: string;
  maxPerRequest: string;
  dailyBudget: string;
  monthlyBudget: string;
  allowedEndpoints: string[];
  blockedEndpoints: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function fetchPolicies(apiKey?: string): Promise<Policy[]> {
  const res = await fetchApi<{ policies: Policy[]; total: number }>('/api/policies', { apiKey });
  return res.policies;
}

export async function fetchPolicy(id: string, apiKey?: string): Promise<Policy> {
  const res = await fetchApi<{ policy: Policy }>(`/api/policies/${id}`, { apiKey });
  return res.policy;
}

export interface CreatePolicyData {
  name: string;
  maxPerRequest?: string;
  dailyBudget: string;
  monthlyBudget: string;
  allowedEndpoints?: string[];
  blockedEndpoints?: string[];
}

export async function createPolicy(data: CreatePolicyData, apiKey?: string): Promise<Policy> {
  const res = await fetchApi<{ policy: Policy }>('/api/policies', {
    method: 'POST',
    body: JSON.stringify(data),
    apiKey,
  });
  return res.policy;
}

export async function updatePolicy(id: string, data: Partial<CreatePolicyData>, apiKey?: string): Promise<Policy> {
  const res = await fetchApi<{ policy: Policy }>(`/api/policies/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
    apiKey,
  });
  return res.policy;
}

export async function deletePolicy(id: string, apiKey?: string): Promise<void> {
  return fetchApi(`/api/policies/${id}`, {
    method: 'DELETE',
    apiKey,
  });
}

// ============================================================
// Curation APIs
// ============================================================

export interface EndpointScore {
  endpoint: string;
  category: string;
  overallScore: number;
  costScore: number;
  latencyScore: number;
  reliabilityScore: number;
  reputationScore?: number;
  sampleSize: number;
  lastCalculated?: string;
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
}

export async function fetchRankings(params?: {
  category?: string;
  limit?: number;
  apiKey?: string;
}): Promise<EndpointScore[]> {
  const query = new URLSearchParams();
  if (params?.category) query.set('category', params.category);
  if (params?.limit) query.set('limit', params.limit.toString());
  const res = await fetchApi<{ data: EndpointScore[] }>(`/api/curation/rankings?${query}`, { apiKey: params?.apiKey });
  return res.data;
}

export interface Category {
  name: string;
  description: string | null;
  endpointCount: number;
  avgScore: number | null;
}

export async function fetchCategories(apiKey?: string): Promise<Category[]> {
  const res = await fetchApi<{ data: Category[] }>('/api/curation/categories', { apiKey });
  return res.data;
}

export async function fetchEndpointScore(endpoint: string, apiKey?: string): Promise<EndpointScore> {
  const res = await fetchApi<{ data: EndpointScore }>(`/api/curation/score/${encodeURIComponent(endpoint)}`, { apiKey });
  return res.data;
}

export interface RecommendedEndpoint extends EndpointScore {
  rank: number;
}

export async function fetchRecommendations(params?: {
  category?: string;
  sortBy?: string;
  limit?: number;
  apiKey?: string;
}): Promise<RecommendedEndpoint[]> {
  const query = new URLSearchParams();
  if (params?.category) query.set('category', params.category);
  if (params?.sortBy) query.set('sortBy', params.sortBy);
  if (params?.limit) query.set('limit', params.limit.toString());
  const res = await fetchApi<{ data: RecommendedEndpoint[] }>(`/api/curation/recommend?${query}`, { apiKey: params?.apiKey });
  return res.data;
}
