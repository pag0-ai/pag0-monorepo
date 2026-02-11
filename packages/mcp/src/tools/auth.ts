/**
 * Shared auth header injection for known API providers.
 *
 * Used by both pag0_request (proxy.ts) and pag0_smart_request (smart.ts).
 */

const AUTH_HEADERS: Record<string, { header: string; format: (k: string) => string }> = {
  "api.openai.com":    { header: "Authorization", format: (k) => `Bearer ${k}` },
  "api.anthropic.com": { header: "x-api-key",     format: (k) => k },
};

/**
 * Inject the correct auth header for a known API provider.
 * Mutates nothing — returns a new headers object.
 */
export function injectAuthHeaders(
  url: string,
  headers: Record<string, string>,
  credentials: Record<string, string>,
): Record<string, string> {
  const hostname = new URL(url).hostname;
  const result = { ...headers };
  const credKey = credentials[hostname];

  if (credKey) {
    const mapping = AUTH_HEADERS[hostname] ?? { header: "Authorization", format: (k: string) => `Bearer ${k}` };
    if (!result[mapping.header] && !result[mapping.header.toLowerCase()]) {
      result[mapping.header] = mapping.format(credKey);
    }
    // Auto-inject required version header for Anthropic
    if (hostname === "api.anthropic.com" && !result["anthropic-version"]) {
      result["anthropic-version"] = "2023-06-01";
    }
  }

  return result;
}
