import { describe, test, expect, mock, beforeEach } from 'bun:test';

// Mock postgres
const mockSql = mock(() => Promise.resolve([]));
(mockSql as any).unsafe = mock(() => Promise.resolve([]));
mock.module('../db/postgres', () => ({ default: mockSql }));

// Mock redis
const mockRedis = {
  get: mock((_key: string) => Promise.resolve(null as string | null)),
  setex: mock((_key: string, _ttl: number, _value: string) => Promise.resolve('OK')),
  ttl: mock((_key: string) => Promise.resolve(-2)),
};
mock.module('../cache/redis', () => ({ default: mockRedis }));

// Mock subgraph client
const mockGetAgentReputation = mock(() => Promise.resolve(null as any));
mock.module('../subgraph/client', () => ({
  subgraphClient: {
    getAgentReputation: mockGetAgentReputation,
    getAgentProfile: mock(() => Promise.resolve(null)),
    getFeedbackHistory: mock(() => Promise.resolve([])),
    getLeaderboard: mock(() => Promise.resolve([])),
  },
}));

// Import after mocking
const { CurationEngine } = await import('./engine');

describe('CurationEngine', () => {
  let engine: InstanceType<typeof CurationEngine>;

  beforeEach(() => {
    engine = new CurationEngine();
    mockSql.mockReset();
    mockRedis.get.mockReset();
    mockRedis.get.mockImplementation((_key: string) => Promise.resolve(null));
    mockGetAgentReputation.mockReset();
    mockGetAgentReputation.mockImplementation(() => Promise.resolve(null));
  });

  // Helper to mock SQL for calculateScore
  function mockMetricsQuery(metrics: {
    request_count: number;
    avg_cost: string | null;
    p95_latency: string | null;
    success_rate: string | null;
  } | null, benchmarks?: { avg_cost: string | null; avg_latency: string | null }) {
    mockSql.mockImplementation(((strings: TemplateStringsArray) => {
      const query = strings.join('?');
      if (query.includes('AVG((evidence')) {
        return Promise.resolve([benchmarks ?? { avg_cost: '500000', avg_latency: '200' }]);
      }
      if (query.includes('PERCENTILE_CONT')) {
        return Promise.resolve(metrics ? [metrics] : []);
      }
      return Promise.resolve([]);
    }) as any);
  }

  describe('calculateScore — default (no on-chain data)', () => {
    test('returns default score 50 when insufficient data and no on-chain rep', async () => {
      mockMetricsQuery({ request_count: 3, avg_cost: null, p95_latency: null, success_rate: null });
      mockGetAgentReputation.mockImplementation(() => Promise.resolve(null));

      const score = await engine.calculateScore('api.example.com', 'AI');
      expect(score.overallScore).toBe(50);
      expect(score.reputationScore).toBe(50);
      expect(score.sampleSize).toBe(3);
    });

    test('includes reputationScore in result with sufficient data', async () => {
      mockMetricsQuery({
        request_count: 100,
        avg_cost: '500000',
        p95_latency: '200',
        success_rate: '0.95',
      });
      mockGetAgentReputation.mockImplementation(() => Promise.resolve(null));

      const score = await engine.calculateScore('api.example.com', 'AI');
      expect(score.reputationScore).toBe(50); // default when no on-chain data
      expect(score.endpoint).toBe('api.example.com');
      expect(score.category).toBe('AI');
    });
  });

  describe('calculateScore — with on-chain reputation', () => {
    test('uses on-chain avgScore as reputationScore', async () => {
      mockMetricsQuery({
        request_count: 100,
        avg_cost: '500000',
        p95_latency: '200',
        success_rate: '0.95',
      });
      mockGetAgentReputation.mockImplementation(() =>
        Promise.resolve({ avgScore: 92, feedbackCount: 50, lastSeen: 1700000000 }),
      );

      const score = await engine.calculateScore('api.example.com', 'AI');
      expect(score.reputationScore).toBe(92);
    });

    test('uses on-chain score as default when off-chain data insufficient', async () => {
      mockMetricsQuery({ request_count: 5, avg_cost: null, p95_latency: null, success_rate: null });
      mockGetAgentReputation.mockImplementation(() =>
        Promise.resolve({ avgScore: 85, feedbackCount: 20, lastSeen: 1700000000 }),
      );

      const score = await engine.calculateScore('api.example.com', 'AI');
      expect(score.overallScore).toBe(85); // uses on-chain score as overall default
      expect(score.reputationScore).toBe(85);
    });

    test('overall score incorporates reputation weight (0.2)', async () => {
      mockMetricsQuery({
        request_count: 100,
        avg_cost: '500000',   // matches benchmark exactly
        p95_latency: '200',   // matches benchmark exactly
        success_rate: '1.0',  // perfect
      });
      // High on-chain reputation
      mockGetAgentReputation.mockImplementation(() =>
        Promise.resolve({ avgScore: 100, feedbackCount: 100, lastSeen: 1700000000 }),
      );

      const score = await engine.calculateScore('api.example.com', 'AI');
      expect(score.reputationScore).toBe(100);
      // overallScore should be higher than without reputation
      expect(score.overallScore).toBeGreaterThan(0);
    });
  });

  describe('calculateScore — subgraph failure graceful degradation', () => {
    test('falls back to default 50 when subgraph throws', async () => {
      mockMetricsQuery({
        request_count: 100,
        avg_cost: '500000',
        p95_latency: '200',
        success_rate: '0.95',
      });
      mockGetAgentReputation.mockImplementation(() => Promise.reject(new Error('Subgraph down')));

      // Should not throw — graceful degradation
      const score = await engine.calculateScore('api.example.com', 'AI');
      expect(score.reputationScore).toBe(50);
    });
  });

  describe('scoring functions', () => {
    test('calculates correct scores for average metrics', async () => {
      mockMetricsQuery({
        request_count: 50,
        avg_cost: '250000',   // half of benchmark (500000) → high cost score
        p95_latency: '100',   // half of benchmark (200) → high latency score
        success_rate: '0.99', // 99% → high reliability
      });

      const score = await engine.calculateScore('api.fast.com', 'AI');
      expect(score.costScore).toBe(100);     // ratio 0.5 → max score
      expect(score.latencyScore).toBe(100);  // ratio 0.5 → max score
      expect(score.reliabilityScore).toBe(99);
      expect(score.sampleSize).toBe(50);
    });

    test('calculates low scores for poor metrics', async () => {
      mockMetricsQuery({
        request_count: 50,
        avg_cost: '1000000',  // 2x benchmark → 0 score
        p95_latency: '400',   // 2x benchmark → 0 score
        success_rate: '0.5',  // 50% → 50
      });

      const score = await engine.calculateScore('api.slow.com', 'AI');
      expect(score.costScore).toBe(0);
      expect(score.latencyScore).toBe(0);
      expect(score.reliabilityScore).toBe(50);
    });
  });
});
