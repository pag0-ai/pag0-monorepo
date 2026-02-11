import { createHash } from 'node:crypto';
import { Context, Next } from 'hono';
import sql from '../db/postgres.js';
import { UnauthorizedError } from '../types/index.js';

interface AuthUser {
  id: string;
  email: string;
  tier: 'free' | 'pro' | 'enterprise';
  projectId: string;
}

/**
 * Auth middleware: validates API Key from X-Pag0-API-Key header
 *
 * Process:
 * 1. Extract API Key from header
 * 2. SHA-256 hash the key
 * 3. Query users table by api_key_hash
 * 4. Join with projects to get active project
 * 5. Set user and projectId on context
 *
 * Throws UnauthorizedError (401) if:
 * - Header missing
 * - Invalid key format
 * - No matching user found
 * - No active project found
 */
export async function authMiddleware(c: Context, next: Next) {
  const apiKey = c.req.header('X-Pag0-API-Key');

  if (!apiKey) {
    throw new UnauthorizedError('Missing X-Pag0-API-Key header');
  }

  // Validate API key format: pag0_live_{32_chars} or pag0_test_{32_chars}
  if (!apiKey.match(/^pag0_(live|test)_[a-zA-Z0-9]{32}$/)) {
    throw new UnauthorizedError('Invalid API key format');
  }

  // Hash the API key with SHA-256
  const apiKeyHash = createHash('sha256').update(apiKey).digest('hex');

  // Query database for user + active project
  const result = await sql<AuthUser[]>`
    SELECT
      u.id,
      u.email,
      u.subscription_tier as tier,
      p.id as project_id
    FROM users u
    JOIN projects p ON p.user_id = u.id AND p.is_active = true
    WHERE u.api_key_hash = ${apiKeyHash}
    LIMIT 1
  `;

  if (result.length === 0) {
    throw new UnauthorizedError('Invalid API key');
  }

  const user = result[0];

  // Set user and project info on context for downstream handlers
  c.set('user', {
    id: user.id,
    email: user.email,
    tier: user.tier,
  });
  c.set('projectId', user.projectId);

  await next();
}

/**
 * Creates a version of auth middleware that skips auth for specific paths
 *
 * @param excludedPaths - Array of paths to exclude from auth (e.g., ['/health', '/api/auth/login'])
 * @returns Hono middleware function
 */
export function authWithExclusions(excludedPaths: string[]) {
  return async (c: Context, next: Next) => {
    const path = new URL(c.req.url).pathname;

    if (excludedPaths.includes(path)) {
      await next();
      return;
    }

    await authMiddleware(c, next);
  };
}
