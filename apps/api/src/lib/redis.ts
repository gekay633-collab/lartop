import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';

export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
});

redis.on('error', (err) => {
  console.error('[redis] connection error:', err.message);
});
