import { Context, Next } from 'hono';
import redis from '../cache/redis.js';
import { RateLimitError } from '../types/index.js';

interface RateLimitConfig {
  free: number;
  pro: number;
  enterprise: number;
}

const RATE_LIMITS: RateLimitConfig = {
  free: 60,
  pro: 1000,
  enterprise: 10000,
};

const WINDOW_SECONDS = 60;

/**
 * Rate limiter middleware: enforces tier-based request limits using Redis
 *
 * Process:
 * 1. Get projectId and tier from context (set by auth middleware)
 * 2. Calculate current minute window
 * 3. INCR Redis counter for rate:{projectId}:{window}
 * 4. Set TTL if this is the first request in the window
 * 5. Check against tier limit
 * 6. Set X-RateLimit-* headers on response
 * 7. Throw RateLimitError (429) if exceeded
 *
 * Key pattern: rate:{projectId}:{minute_window}
 * TTL: 60 seconds (fixed window)
 *
 * Rate limits:
 * - Free: 60 req/min
 * - Pro: 1000 req/min
 * - Enterprise: 10000 req/min
 */
export async function rateLimitMiddleware(c: Context, next: Next) {
  // Get projectId and tier from context (set by auth middleware)
  const projectId = c.get('projectId') as string | undefined;
  const user = c.get('user') as { tier: 'free' | 'pro' | 'enterprise' } | undefined;

  // Skip rate limiting if no project/user (e.g., public endpoints)
  if (!projectId || !user) {
    await next();
    return;
  }

  const tier = user.tier;
  const limit = RATE_LIMITS[tier];

  // Calculate current minute window (Unix timestamp / 60)
  const now = Math.floor(Date.now() / 1000);
  const window = Math.floor(now / WINDOW_SECONDS);
  const resetTime = (window + 1) * WINDOW_SECONDS;

  // Redis key: rate:{projectId}:{window}
  const key = `rate:${projectId}:${window}`;

  // Increment counter and get current count
  const count = await redis.incr(key);

  // Set TTL on first request in this window (INCR returns 1)
  if (count === 1) {
    await redis.expire(key, WINDOW_SECONDS);
  }

  // Calculate remaining requests
  const remaining = Math.max(0, limit - count);

  // Set rate limit headers (always, even if not exceeded)
  c.header('X-RateLimit-Limit', limit.toString());
  c.header('X-RateLimit-Remaining', remaining.toString());
  c.header('X-RateLimit-Reset', resetTime.toString());

  // Check if rate limit exceeded
  if (count > limit) {
    const retryAfter = resetTime - now;
    throw new RateLimitError(
      `Rate limit exceeded. Limit: ${limit} req/min, tier: ${tier}`,
      retryAfter
    );
  }

  await next();
}

/**
 * Creates a custom rate limiter with different limits
 *
 * @param customLimits - Custom rate limits per tier
 * @returns Hono middleware function
 */
export function createRateLimiter(customLimits: Partial<RateLimitConfig>) {
  const limits = { ...RATE_LIMITS, ...customLimits };

  return async (c: Context, next: Next) => {
    const projectId = c.get('projectId') as string | undefined;
    const user = c.get('user') as { tier: 'free' | 'pro' | 'enterprise' } | undefined;

    if (!projectId || !user) {
      await next();
      return;
    }

    const tier = user.tier;
    const limit = limits[tier];

    const now = Math.floor(Date.now() / 1000);
    const window = Math.floor(now / WINDOW_SECONDS);
    const resetTime = (window + 1) * WINDOW_SECONDS;

    const key = `rate:${projectId}:${window}`;

    const count = await redis.incr(key);

    if (count === 1) {
      await redis.expire(key, WINDOW_SECONDS);
    }

    const remaining = Math.max(0, limit - count);

    c.header('X-RateLimit-Limit', limit.toString());
    c.header('X-RateLimit-Remaining', remaining.toString());
    c.header('X-RateLimit-Reset', resetTime.toString());

    if (count > limit) {
      const retryAfter = resetTime - now;
      throw new RateLimitError(
        `Rate limit exceeded. Limit: ${limit} req/min, tier: ${tier}`,
        retryAfter
      );
    }

    await next();
  };
}
