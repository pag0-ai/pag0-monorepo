import { Hono } from "hono";
import { curationEngine } from "../curation/engine";
import { proxyCore, type ProxyCoreResponse } from "../proxy/core";
import type { EndpointScore } from "../types";

type Variables = {
  projectId: string;
};

// ── Provider config (same 2 providers as MCP smart tool) ──────

interface ProviderConfig {
  chatUrl: string;
  buildBody: (prompt: string, maxTokens: number) => unknown;
  extractText: (body: unknown) => string;
}

const PROVIDER_CONFIG: Record<string, ProviderConfig> = {
  "api.openai.com": {
    chatUrl: "https://api.openai.com/v1/chat/completions",
    buildBody: (prompt, maxTokens) => ({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: maxTokens,
    }),
    extractText: (body: unknown) => {
      const b = body as { choices?: { message?: { content?: string } }[] };
      return b?.choices?.[0]?.message?.content ?? JSON.stringify(body);
    },
  },
  "api.anthropic.com": {
    chatUrl: "https://api.anthropic.com/v1/messages",
    buildBody: (prompt, maxTokens) => ({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
    extractText: (body: unknown) => {
      const b = body as { content?: { type?: string; text?: string }[] };
      return b?.content?.[0]?.text ?? JSON.stringify(body);
    },
  },
};

// ── Auth header injection (server-side version) ───────────────

const AUTH_HEADERS: Record<
  string,
  { header: string; format: (k: string) => string }
> = {
  "api.openai.com": { header: "Authorization", format: (k) => `Bearer ${k}` },
  "api.anthropic.com": { header: "x-api-key", format: (k) => k },
};

function injectAuthHeaders(url: string): Record<string, string> {
  const hostname = new URL(url).hostname;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // Read API keys from env
  const envKeys: Record<string, string | undefined> = {
    "api.openai.com": process.env.OPENAI_API_KEY,
    "api.anthropic.com": process.env.ANTHROPIC_API_KEY,
  };

  const key = envKeys[hostname];
  if (key) {
    const mapping = AUTH_HEADERS[hostname];
    if (mapping) {
      headers[mapping.header] = mapping.format(key);
    }
    if (hostname === "api.anthropic.com") {
      headers["anthropic-version"] = "2023-06-01";
    }
  }

  return headers;
}

// ── Route ─────────────────────────────────────────────────────

const VALID_CATEGORIES = ["AI", "Data", "Blockchain", "IoT", "Finance"];
const VALID_SORT_BY = ["overall", "cost", "latency", "reliability"];

const app = new Hono<{ Variables: Variables }>();

app.post("/", async (c) => {
  const projectId = c.get("projectId");

  // ── 1. Parse & validate ───────────────────────────────────
  let body: {
    category?: string;
    prompt?: string;
    maxTokens?: number;
    sortBy?: string;
    signedPayment?: unknown;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid JSON body" } },
      400,
    );
  }

  if (!body.category || typeof body.category !== "string") {
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: "category is required" } },
      400,
    );
  }
  if (!VALID_CATEGORIES.includes(body.category)) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: `category must be one of: ${VALID_CATEGORIES.join(", ")}`,
        },
      },
      400,
    );
  }
  if (!body.prompt || typeof body.prompt !== "string") {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "prompt is required and must be a string",
        },
      },
      400,
    );
  }

  const maxTokens = body.maxTokens ?? 100;
  const sortBy = (body.sortBy ?? "overall") as
    | "overall"
    | "cost"
    | "latency"
    | "reliability";
  if (!VALID_SORT_BY.includes(sortBy)) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: `sortBy must be one of: ${VALID_SORT_BY.join(", ")}`,
        },
      },
      400,
    );
  }

  try {
    // ── 2. Get recommendations ────────────────────────────────
    const recommendations = await curationEngine.getRecommendations(
      body.category,
      5,
      sortBy,
    );

    if (recommendations.length === 0) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: `No endpoints found in category "${body.category}"`,
          },
        },
        404,
      );
    }

    // ── 3. Compare top 2 (skip if only 1) ─────────────────────
    let winner = recommendations[0].endpoint;
    let rationale = `Only one endpoint available in "${body.category}": ${winner}`;
    let comparisonResult: {
      endpoints: EndpointScore[];
      winner: Record<string, string>;
    } | null = null;

    if (recommendations.length >= 2) {
      const top2 = recommendations.slice(0, 2).map((r) => r.endpoint);
      try {
        const comparison = await curationEngine.compareEndpoints(top2);
        comparisonResult = comparison;
        winner = comparison.winner.overall;
        const w = comparison.winner;
        rationale = `Compared ${top2.join(
          " vs ",
        )}. Winner: ${winner} (overall: ${w.overall}, cost: ${
          w.cost
        }, latency: ${w.latency}, reliability: ${w.reliability})`;
      } catch {
        rationale = `Comparison failed; falling back to top recommendation: ${winner}`;
      }
    }

    // ── 4. Look up provider config ────────────────────────────
    const provider = PROVIDER_CONFIG[winner];
    if (!provider) {
      return c.json(
        {
          error: {
            code: "UNSUPPORTED_PROVIDER",
            message: `Winner "${winner}" is not in the supported provider list (${Object.keys(
              PROVIDER_CONFIG,
            ).join(", ")})`,
          },
        },
        400,
      );
    }

    // ── 5. Build request and call via proxyCore ───────────────
    const targetUrl = provider.chatUrl;
    const requestBody = provider.buildBody(body.prompt, maxTokens);
    const headers = injectAuthHeaders(targetUrl);

    const result = await proxyCore.handleRequest({
      targetUrl,
      method: "POST",
      headers,
      body: requestBody,
      projectId,
      signedPayment: body.signedPayment,
    });

    const selection = {
      winner,
      rationale,
      comparison: comparisonResult,
    };

    // ── 6. Handle 402 — return payment request with selection ──
    if (result.status === 402) {
      const payment402 = result as { status: 402; paymentInfo: unknown; metadata: { endpoint: string; latency: number } };
      return c.json(
        {
          status: 402,
          body: { paymentRequest: payment402.paymentInfo },
          metadata: payment402.metadata,
          selection,
        },
        402,
      );
    }

    // Narrow to ProxyCoreResponse after 402 is handled
    const res = result as ProxyCoreResponse;

    // ── 7. Handle upstream errors ─────────────────────────────
    if (res.status >= 500) {
      return c.json(
        {
          error: {
            code: "UPSTREAM_ERROR",
            message: "Upstream provider returned an error",
            details: res.body,
          },
        },
        502,
      );
    }

    // ── 8. Success — extract text and return ──────────────────
    const responseText = provider.extractText(res.body);

    return c.json({
      data: {
        selection,
        response: {
          text: responseText,
          raw: res.body,
        },
        metadata: {
          status: res.status,
          cost: res.metadata.cost,
          cached: res.metadata.cached,
          latency: res.metadata.latency,
          endpoint: res.metadata.endpoint,
          budgetRemaining: res.metadata.budgetRemaining,
        },
      },
    });
  } catch (err) {
    // Let PolicyViolationError / RateLimitError propagate to global handler
    if (
      err instanceof Error &&
      (err.name === "PolicyViolationError" || err.name === "RateLimitError")
    ) {
      throw err;
    }
    console.error("Error in /api/smart-request:", err);
    return c.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Smart request failed",
          details: err instanceof Error ? err.message : String(err),
        },
      },
      500,
    );
  }
});

export default app;
