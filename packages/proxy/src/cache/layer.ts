import { createHash } from 'node:crypto';
import redis from './redis.js';

export interface CacheConfig {
  enabled: boolean;
  defaultTTLSeconds: number;
  maxCacheSizeBytes: number;
  ttlRules?: Array<{ pattern: string; ttlSeconds: number }>;
  excludePatterns?: string[];
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
}

const defaultConfig: CacheConfig = {
  enabled: true,
  defaultTTLSeconds: 300, // 5 minutes
  maxCacheSizeBytes: 1024 * 1024, // 1MB
  ttlRules: [
    { pattern: '*/models*', ttlSeconds: 3600 }, // Model lists: 1 hour
    { pattern: '*/realtime*', ttlSeconds: 10 }, // Realtime: 10 seconds
    { pattern: '*/weather*', ttlSeconds: 600 }, // Weather: 10 minutes
  ],
  excludePatterns: ['*/stream*', '*/events*'],
};

export class CacheLayer {
  private config: CacheConfig;
  private stats = { hits: 0, misses: 0 };

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  /**
   * Generate cache key from URL, method, and optional body
   * Pattern: cache:{sha256(method:url[:body])}
   */
  generateKey(url: string, method: string, body?: string): string {
    const hash = createHash('sha256');
    hash.update(`${method}:${url}`);
    if (body) {
      hash.update(`:${body}`);
    }
    return `cache:${hash.digest('hex')}`;
  }

  /**
   * Check if a request/response is cacheable
   * 4 conditions must ALL be met:
   * 1. HTTP status 2xx
   * 2. GET or idempotent method (GET, HEAD, OPTIONS)
   * 3. No Cache-Control: no-store header
   * 4. Response size < maxCacheSizeBytes
   */
  isCacheable(
    request: {
      method: string;
      url: string;
    },
    response: {
      status: number;
      headers: Record<string, string>;
      body: unknown;
    },
  ): boolean {
    // Condition 1: HTTP status 2xx
    if (response.status < 200 || response.status >= 300) {
      return false;
    }

    // Condition 2: GET or idempotent method
    const method = request.method.toUpperCase();
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      return false;
    }

    // Condition 3: No Cache-Control: no-store
    const cacheControl = response.headers['cache-control'] || response.headers['Cache-Control'];
    if (cacheControl && cacheControl.includes('no-store')) {
      return false;
    }

    // Condition 4: Response size < maxCacheSizeBytes
    const serialized = JSON.stringify(response.body);
    if (serialized.length > this.config.maxCacheSizeBytes) {
      return false;
    }

    // Check exclude patterns
    if (this.isExcluded(request.url)) {
      return false;
    }

    return true;
  }

  /**
   * Get cached response from Redis
   * Returns null on cache miss
   */
  async get(key: string): Promise<unknown | null> {
    try {
      const cached = await redis.get(key);
      if (cached === null) {
        this.stats.misses++;
        return null;
      }
      this.stats.hits++;
      return JSON.parse(cached);
    } catch (error) {
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Store response in Redis with TTL
   * TTL determined by URL pattern matching or default
   */
  async set(key: string, response: unknown, url?: string): Promise<void> {
    try {
      const ttl = url ? this.getTTL(url) : this.config.defaultTTLSeconds;
      const serialized = JSON.stringify(response);
      await redis.setex(key, ttl, serialized);
    } catch (error) {
      // Silent fail on cache write errors
    }
  }

  /**
   * Invalidate cache entries matching a pattern
   * Uses KEYS for MVP (production should use SCAN)
   */
  async invalidate(pattern: string): Promise<number> {
    try {
      const keys = await redis.keys(pattern);
      if (keys.length === 0) {
        return 0;
      }
      return await redis.del(...keys);
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: total > 0 ? this.stats.hits / total : 0,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = { hits: 0, misses: 0 };
  }

  /**
   * Get TTL for a URL based on pattern rules
   */
  private getTTL(url: string): number {
    if (!this.config.ttlRules) {
      return this.config.defaultTTLSeconds;
    }

    for (const rule of this.config.ttlRules) {
      if (this.matchPattern(url, rule.pattern)) {
        return rule.ttlSeconds;
      }
    }

    return this.config.defaultTTLSeconds;
  }

  /**
   * Check if URL matches an exclude pattern
   */
  private isExcluded(url: string): boolean {
    if (!this.config.excludePatterns) {
      return false;
    }

    return this.config.excludePatterns.some((pattern) =>
      this.matchPattern(url, pattern)
    );
  }

  /**
   * Match URL against a pattern with wildcards
   * Example: "*.example.com" matches any subdomain of example.com
   */
  private matchPattern(url: string, pattern: string): boolean {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return regex.test(url);
  }
}

// Export singleton instance
export const cacheLayer = new CacheLayer();
