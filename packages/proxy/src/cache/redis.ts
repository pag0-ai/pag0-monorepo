import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  throw new Error('REDIS_URL environment variable is required');
}

const redis = new Redis(redisUrl, {
  tls: redisUrl.startsWith('rediss://') ? {} : undefined,
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    return Math.min(times * 50, 2000);
  },
});

export default redis;
