const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

function getApiKey(): string {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('pag0_api_key') || '';
  }
  return process.env.NEXT_PUBLIC_API_KEY || '';
}

export async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const apiKey = getApiKey();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(apiKey && { 'X-Pag0-API-Key': apiKey }),
    ...(options?.headers as Record<string, string>),
  };

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(error.error?.message ?? `API error: ${res.status}`);
  }

  return res.json();
}

// Analytics APIs
export interface AnalyticsSummary {
  totalRequests: number;
  totalCost: string;
  cacheHitRate: number;
  avgLatency: number;
}

export async function fetchAnalyticsSummary(period: string = '7d'): Promise<AnalyticsSummary> {
  return fetchApi(`/api/analytics/summary?period=${period}`);
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
}): Promise<EndpointMetrics[]> {
  const query = new URLSearchParams();
  if (params?.period) query.set('period', params.period);
  if (params?.limit) query.set('limit', params.limit.toString());
  return fetchApi(`/api/analytics/endpoints?${query}`);
}

export interface CostDataPoint {
  timestamp: string;
  cost: string;
}

export async function fetchAnalyticsCosts(params?: {
  period?: string;
  granularity?: string;
}): Promise<CostDataPoint[]> {
  const query = new URLSearchParams();
  if (params?.period) query.set('period', params.period);
  if (params?.granularity) query.set('granularity', params.granularity);
  return fetchApi(`/api/analytics/costs?${query}`);
}

export interface CacheStats {
  hitRate: number;
  totalHits: number;
  totalMisses: number;
  savedCost: string;
}

export async function fetchAnalyticsCache(period: string = '7d'): Promise<CacheStats> {
  return fetchApi(`/api/analytics/cache?period=${period}`);
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

export async function fetchPolicies(): Promise<Policy[]> {
  return fetchApi('/api/policies');
}

export async function fetchPolicy(id: string): Promise<Policy> {
  return fetchApi(`/api/policies/${id}`);
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

export async function createPolicy(data: CreatePolicyData): Promise<Policy> {
  return fetchApi('/api/policies', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updatePolicy(id: string, data: Partial<CreatePolicyData>): Promise<Policy> {
  return fetchApi(`/api/policies/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deletePolicy(id: string): Promise<void> {
  return fetchApi(`/api/policies/${id}`, {
    method: 'DELETE',
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
}): Promise<EndpointScore[]> {
  const query = new URLSearchParams();
  if (params?.category) query.set('category', params.category);
  if (params?.limit) query.set('limit', params.limit.toString());
  return fetchApi(`/api/curation/rankings?${query}`);
}

export interface Category {
  id: string;
  name: string;
  description: string;
}

export async function fetchCategories(): Promise<Category[]> {
  return fetchApi('/api/curation/categories');
}
