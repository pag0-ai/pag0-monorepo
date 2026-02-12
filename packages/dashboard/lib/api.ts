import { useSession } from 'next-auth/react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

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

  const res = await fetch(`${API_BASE}${path}`, {
    ...restOptions,
    headers,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(error.error?.message ?? `API error: ${res.status}`);
  }

  return res.json();
}

// Helper to create a fetchApi bound to a specific API key (for use with react-query)
export function createApiFetcher(apiKey: string) {
  return <T>(path: string, options?: RequestInit) =>
    fetchApi<T>(path, { ...options, apiKey });
}

// Analytics APIs
export interface AnalyticsSummary {
  totalRequests: number;
  totalCost: string;
  cacheHitRate: number;
  avgLatency: number;
}

export async function fetchAnalyticsSummary(period: string = '7d', apiKey?: string): Promise<AnalyticsSummary> {
  return fetchApi(`/api/analytics/summary?period=${period}`, { apiKey });
}

export interface EndpointMetrics {
  endpoint: string;
  requestCount: number;
  totalCost: string;
  avgLatency: number;
  cacheHitRate: number;
}

export async function fetchAnalyticsEndpoints(params?: {
  period?: string;
  limit?: number;
  apiKey?: string;
}): Promise<EndpointMetrics[]> {
  const query = new URLSearchParams();
  if (params?.period) query.set('period', params.period);
  if (params?.limit) query.set('limit', params.limit.toString());
  return fetchApi(`/api/analytics/endpoints?${query}`, { apiKey: params?.apiKey });
}

export interface CostDataPoint {
  timestamp: string;
  cost: string;
}

export async function fetchAnalyticsCosts(params?: {
  period?: string;
  granularity?: string;
  apiKey?: string;
}): Promise<CostDataPoint[]> {
  const query = new URLSearchParams();
  if (params?.period) query.set('period', params.period);
  if (params?.granularity) query.set('granularity', params.granularity);
  return fetchApi(`/api/analytics/costs?${query}`, { apiKey: params?.apiKey });
}

export interface CacheStats {
  hitRate: number;
  totalHits: number;
  totalMisses: number;
  savedCost: string;
}

export async function fetchAnalyticsCache(period: string = '7d', apiKey?: string): Promise<CacheStats> {
  return fetchApi(`/api/analytics/cache?period=${period}`, { apiKey });
}

// Policy APIs
export interface Policy {
  id: string;
  projectId: string;
  name: string;
  dailyBudget: string;
  monthlyBudget: string;
  whitelist: string[];
  blacklist: string[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function fetchPolicies(apiKey?: string): Promise<Policy[]> {
  return fetchApi('/api/policies', { apiKey });
}

export async function fetchPolicy(id: string, apiKey?: string): Promise<Policy> {
  return fetchApi(`/api/policies/${id}`, { apiKey });
}

export interface CreatePolicyData {
  projectId: string;
  name: string;
  dailyBudget: string;
  monthlyBudget: string;
  whitelist?: string[];
  blacklist?: string[];
  enabled?: boolean;
}

export async function createPolicy(data: CreatePolicyData, apiKey?: string): Promise<Policy> {
  return fetchApi('/api/policies', {
    method: 'POST',
    body: JSON.stringify(data),
    apiKey,
  });
}

export async function updatePolicy(id: string, data: Partial<CreatePolicyData>, apiKey?: string): Promise<Policy> {
  return fetchApi(`/api/policies/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
    apiKey,
  });
}

export async function deletePolicy(id: string, apiKey?: string): Promise<void> {
  return fetchApi(`/api/policies/${id}`, {
    method: 'DELETE',
    apiKey,
  });
}

// Curation APIs
export interface EndpointScore {
  endpoint: string;
  overall: number;
  cost: number;
  latency: number;
  reliability: number;
  category: string;
}

export async function fetchRankings(params?: {
  category?: string;
  limit?: number;
  apiKey?: string;
}): Promise<EndpointScore[]> {
  const query = new URLSearchParams();
  if (params?.category) query.set('category', params.category);
  if (params?.limit) query.set('limit', params.limit.toString());
  return fetchApi(`/api/curation/rankings?${query}`, { apiKey: params?.apiKey });
}

export interface Category {
  id: string;
  name: string;
  description: string;
}

export async function fetchCategories(apiKey?: string): Promise<Category[]> {
  return fetchApi('/api/curation/categories', { apiKey });
}
