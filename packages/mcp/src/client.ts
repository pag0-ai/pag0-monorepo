/**
 * Pag0 Proxy API HTTP Client
 *
 * All monetary values are USDC with 6 decimals (BIGINT string).
 * 1 USDC = "1000000"
 */

export interface ProxyRequestParams {
  targetUrl: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  cacheBypass?: boolean;
  signedPayment?: unknown;
}

export interface ProxyResponse {
  status: number;
  headers: Record<string, string>;
  body: unknown;
  metadata: {
    cost: string;
    cached: boolean;
    cacheAge?: number;
    latency: number;
    endpoint: string;
    budgetRemaining: {
      daily: string;
      monthly: string;
    };
  };
}

export interface PaymentRequest {
  id: string;
  amount: string;
  recipient: string;
  facilitatorUrl: string;
  expiresAt: number;
}

export class Pag0Client {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.apiKey = apiKey;
  }

  private get headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      "X-Pag0-API-Key": this.apiKey,
    };
  }

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: this.headers,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(`Pag0 API ${res.status}: ${JSON.stringify(err)}`);
    }
    return res.json() as Promise<T>;
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(`Pag0 API ${res.status}: ${JSON.stringify(err)}`);
    }
    return res.json() as Promise<T>;
  }

  // ── Proxy (raw fetch — must handle 402 manually) ─────────

  async proxyRequest(params: ProxyRequestParams): Promise<Response> {
    return fetch(`${this.baseUrl}/proxy`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(params),
    });
  }

  // ── Analytics ────────────────────────────────────────────

  async getAnalyticsSummary(period = "7d") {
    return this.get(`/api/analytics/summary?period=${period}`);
  }

  async getAnalyticsEndpoints(params?: {
    period?: string;
    limit?: number;
    orderBy?: string;
  }) {
    const qs = new URLSearchParams();
    if (params?.period) qs.set("period", params.period);
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.orderBy) qs.set("orderBy", params.orderBy);
    return this.get(`/api/analytics/endpoints?${qs}`);
  }

  async getAnalyticsCache(period = "7d") {
    return this.get(`/api/analytics/cache?period=${period}`);
  }

  // ── Policies ─────────────────────────────────────────────

  async getPolicies() {
    return this.get("/api/policies");
  }

  async createPolicy(policy: Record<string, unknown>) {
    return this.post("/api/policies", policy);
  }

  // ── Curation ─────────────────────────────────────────────

  async getRecommendations(params: {
    category: string;
    limit?: number;
    sortBy?: string;
  }) {
    const qs = new URLSearchParams({ category: params.category });
    if (params.limit) qs.set("limit", String(params.limit));
    if (params.sortBy) qs.set("sortBy", params.sortBy);
    return this.get(`/api/curation/recommend?${qs}`);
  }

  async getComparison(endpoints: string[]) {
    const qs = new URLSearchParams({ endpoints: endpoints.join(",") });
    return this.get(`/api/curation/compare?${qs}`);
  }

  async getRankings(params?: { category?: string; limit?: number }) {
    const qs = new URLSearchParams();
    if (params?.category) qs.set("category", params.category);
    if (params?.limit) qs.set("limit", String(params.limit));
    return this.get(`/api/curation/rankings?${qs}`);
  }

  async getScore(endpoint: string) {
    return this.get(
      `/api/curation/score/${encodeURIComponent(endpoint)}`,
    );
  }

  // ── ERC-8004 Reputation (on-chain) ──────────────────────────

  async getReputationAgent(endpoint: string) {
    const qs = new URLSearchParams({ id: endpoint });
    return this.get(`/api/reputation/agent?${qs}`);
  }

  async getReputationFeedbacks(params: {
    agentId: string;
    first?: number;
    skip?: number;
  }) {
    const qs = new URLSearchParams({ agentId: params.agentId });
    if (params.first) qs.set("first", String(params.first));
    if (params.skip) qs.set("skip", String(params.skip));
    return this.get(`/api/reputation/feedbacks?${qs}`);
  }

  async getReputationLeaderboard(first = 20) {
    const qs = new URLSearchParams({ first: String(first) });
    return this.get(`/api/reputation/leaderboard?${qs}`);
  }

  // ── Smart Request ──────────────────────────────────────────

  async smartRequest(params: {
    category: string;
    prompt: string;
    maxTokens?: number;
    sortBy?: string;
    signedPayment?: unknown;
  }): Promise<Response> {
    return fetch(`${this.baseUrl}/api/smart-request`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(params),
    });
  }

  // ── Smart Request Select (curation only, no upstream call) ──

  async smartRequestSelect(params: {
    category: string;
    prompt: string;
    maxTokens?: number;
    sortBy?: string;
  }): Promise<SmartSelectResult> {
    return this.post<SmartSelectResult>(
      "/api/smart-request/select",
      params,
    );
  }
}

export interface SmartSelectResult {
  targetUrl: string;
  method: string;
  body: unknown;
  selection: {
    winner: string;
    rationale: string;
    comparison: unknown;
  };
}
