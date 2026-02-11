import { describe, test, expect, mock, beforeEach } from 'bun:test';
import type { Policy, ProxyRequest } from '../types';

// Mock postgres
const mockSql = mock(() => Promise.resolve([]));
(mockSql as any).unsafe = mock(() => Promise.resolve([]));
mock.module('../db/postgres', () => ({ default: mockSql }));

// Mock redis
const mockRedis = {
  get: mock(() => Promise.resolve(null)),
  incrby: mock(() => Promise.resolve(0)),
  ttl: mock(() => Promise.resolve(-2)),
  expire: mock(() => Promise.resolve(1)),
  del: mock(() => Promise.resolve(1)),
};
mock.module('../cache/redis', () => ({ default: mockRedis }));

// Import after mocking
const { PolicyEngine } = await import('./engine');

const makePolicy = (overrides: Partial<Policy> = {}): Policy => ({
  id: 'policy-1',
  projectId: 'project-1',
  name: 'Test Policy',
  maxPerRequest: '5000000',    // 5 USDC
  dailyLimit: '50000000',      // 50 USDC
  monthlyLimit: '500000000',   // 500 USDC
  allowedEndpoints: [],
  blockedEndpoints: [],
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const makeRequest = (overrides: Partial<ProxyRequest> = {}): ProxyRequest => ({
  targetUrl: 'https://api.openai.com/v1/chat/completions',
  method: 'POST',
  projectId: 'project-1',
  ...overrides,
});

describe('PolicyEngine', () => {
  let engine: InstanceType<typeof PolicyEngine>;

  beforeEach(() => {
    engine = new PolicyEngine();
    mockSql.mockReset();
    mockRedis.get.mockReset();
    mockRedis.get.mockImplementation(() => Promise.resolve(null));
  });

  // Helper to make mockSql return a policy
  function mockPolicyQuery(policy: Policy | null) {
    mockSql.mockImplementation(((strings: TemplateStringsArray, ...values: any[]) => {
      const query = strings.join('?');
      // budgets query (check first — it also contains 'policies' due to JOIN)
      if (query.includes('FROM budgets')) {
        return Promise.resolve([{
          dailySpent: '0',
          monthlySpent: '0',
          dailyLimit: policy?.dailyLimit || '999999999999999',
          monthlyLimit: policy?.monthlyLimit || '999999999999999',
        }]);
      }
      // policies query
      if (query.includes('FROM policies')) {
        return Promise.resolve(policy ? [policy] : []);
      }
      return Promise.resolve([]);
    }) as any);
  }

  describe('evaluate — no active policy', () => {
    test('allows request when no policy exists', async () => {
      mockPolicyQuery(null);
      const result = await engine.evaluate(makeRequest(), '1000000');
      expect(result.allowed).toBe(true);
      expect(result.policy.name).toBe('Default (No Restrictions)');
    });
  });

  describe('evaluate — blocked endpoints', () => {
    test('blocks request to blocked endpoint', async () => {
      mockPolicyQuery(makePolicy({
        blockedEndpoints: ['api.openai.com'],
      }));
      const result = await engine.evaluate(makeRequest(), '1000000');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('ENDPOINT_BLOCKED');
    });

    test('blocks request matching wildcard pattern', async () => {
      mockPolicyQuery(makePolicy({
        blockedEndpoints: ['*.openai.com'],
      }));
      const result = await engine.evaluate(makeRequest(), '1000000');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('ENDPOINT_BLOCKED');
    });

    test('allows request to non-blocked endpoint', async () => {
      mockPolicyQuery(makePolicy({
        blockedEndpoints: ['api.blocked.com'],
      }));
      const result = await engine.evaluate(makeRequest(), '1000000');
      expect(result.allowed).toBe(true);
    });
  });

  describe('evaluate — whitelisted endpoints', () => {
    test('allows request to whitelisted endpoint', async () => {
      mockPolicyQuery(makePolicy({
        allowedEndpoints: ['api.openai.com'],
      }));
      const result = await engine.evaluate(makeRequest(), '1000000');
      expect(result.allowed).toBe(true);
    });

    test('allows request matching wildcard whitelist', async () => {
      mockPolicyQuery(makePolicy({
        allowedEndpoints: ['*.openai.com'],
      }));
      const result = await engine.evaluate(makeRequest(), '1000000');
      expect(result.allowed).toBe(true);
    });

    test('blocks request not in whitelist', async () => {
      mockPolicyQuery(makePolicy({
        allowedEndpoints: ['api.anthropic.com'],
      }));
      const result = await engine.evaluate(makeRequest(), '1000000');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('ENDPOINT_NOT_WHITELISTED');
    });

    test('allows all when whitelist is empty', async () => {
      mockPolicyQuery(makePolicy({
        allowedEndpoints: [],
      }));
      const result = await engine.evaluate(makeRequest(), '1000000');
      expect(result.allowed).toBe(true);
    });
  });

  describe('evaluate — per-request limit (BigInt)', () => {
    test('allows request within per-request limit', async () => {
      mockPolicyQuery(makePolicy({ maxPerRequest: '5000000' }));
      const result = await engine.evaluate(makeRequest(), '4000000');
      expect(result.allowed).toBe(true);
    });

    test('allows request at exact limit', async () => {
      mockPolicyQuery(makePolicy({ maxPerRequest: '5000000' }));
      const result = await engine.evaluate(makeRequest(), '5000000');
      expect(result.allowed).toBe(true);
    });

    test('blocks request exceeding per-request limit', async () => {
      mockPolicyQuery(makePolicy({ maxPerRequest: '5000000' }));
      const result = await engine.evaluate(makeRequest(), '5000001');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('PER_REQUEST_LIMIT_EXCEEDED');
    });

    test('handles large BigInt amounts correctly', async () => {
      mockPolicyQuery(makePolicy({
        maxPerRequest: '999999999999999',
        dailyLimit: '999999999999999',
        monthlyLimit: '999999999999999',
      }));
      const result = await engine.evaluate(makeRequest(), '999999999999998');
      expect(result.allowed).toBe(true);
    });
  });

  describe('evaluate — daily budget (BigInt)', () => {
    test('blocks when daily budget would be exceeded', async () => {
      const policy = makePolicy({ dailyLimit: '10000000' }); // 10 USDC
      mockPolicyQuery(policy);
      // Simulate 9 USDC already spent
      mockRedis.get.mockImplementation((key: string) => {
        if (key.includes(':daily')) return Promise.resolve('9000000');
        if (key.includes(':monthly')) return Promise.resolve('9000000');
        return Promise.resolve(null);
      });

      const result = await engine.evaluate(makeRequest(), '2000000'); // 2 USDC
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('DAILY_BUDGET_EXCEEDED');
    });

    test('allows when daily budget has room', async () => {
      const policy = makePolicy({ dailyLimit: '10000000' });
      mockPolicyQuery(policy);
      mockRedis.get.mockImplementation((key: string) => {
        if (key.includes(':daily')) return Promise.resolve('5000000');
        if (key.includes(':monthly')) return Promise.resolve('5000000');
        return Promise.resolve(null);
      });

      const result = await engine.evaluate(makeRequest(), '4000000'); // 4 USDC
      expect(result.allowed).toBe(true);
    });
  });

  describe('evaluate — monthly budget (BigInt)', () => {
    test('blocks when monthly budget would be exceeded', async () => {
      const policy = makePolicy({
        dailyLimit: '999999999999999', // large daily limit
        monthlyLimit: '20000000', // 20 USDC monthly
      });
      mockPolicyQuery(policy);
      mockRedis.get.mockImplementation((key: string) => {
        if (key.includes(':daily')) return Promise.resolve('1000000');
        if (key.includes(':monthly')) return Promise.resolve('19000000'); // 19 USDC spent
        return Promise.resolve(null);
      });

      const result = await engine.evaluate(makeRequest(), '2000000'); // 2 USDC
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('MONTHLY_BUDGET_EXCEEDED');
    });
  });

  describe('wildcard pattern matching', () => {
    test('matches exact hostname', async () => {
      mockPolicyQuery(makePolicy({ blockedEndpoints: ['api.openai.com'] }));
      const result = await engine.evaluate(
        makeRequest({ targetUrl: 'https://api.openai.com/v1/chat' }),
        '1000000',
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('ENDPOINT_BLOCKED');
    });

    test('matches *.domain.com wildcard', async () => {
      mockPolicyQuery(makePolicy({ blockedEndpoints: ['*.openai.com'] }));
      const result = await engine.evaluate(
        makeRequest({ targetUrl: 'https://api.openai.com/v1/chat' }),
        '1000000',
      );
      expect(result.allowed).toBe(false);
    });

    test('matches *.com broad wildcard', async () => {
      mockPolicyQuery(makePolicy({ blockedEndpoints: ['*.com'] }));
      const result = await engine.evaluate(
        makeRequest({ targetUrl: 'https://api.openai.com/v1/chat' }),
        '1000000',
      );
      expect(result.allowed).toBe(false);
    });

    test('does not match different domain', async () => {
      mockPolicyQuery(makePolicy({ blockedEndpoints: ['*.anthropic.com'] }));
      const result = await engine.evaluate(
        makeRequest({ targetUrl: 'https://api.openai.com/v1/chat' }),
        '1000000',
      );
      expect(result.allowed).toBe(true);
    });

    test('case-insensitive matching', async () => {
      mockPolicyQuery(makePolicy({ blockedEndpoints: ['*.OpenAI.COM'] }));
      const result = await engine.evaluate(
        makeRequest({ targetUrl: 'https://api.openai.com/v1/chat' }),
        '1000000',
      );
      expect(result.allowed).toBe(false);
    });
  });
});
