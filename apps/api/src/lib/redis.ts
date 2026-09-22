import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';

export const redis = new (Redis as any)(redisUrl, {
  maxRetriesPerRequest: 3,
});

redis.on('error', (err: Error) => {
  console.error('[redis] connection error:', err.message);
});
