import type { FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import { redis } from '../lib/redis.js';

export async function registrarSeguranca(app: FastifyInstance) {
  await app.register(helmet, {
    contentSecurityPolicy: false,
  });

  await app.register(cors, {
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  });

  await app.register(cookie);

  await app.register(rateLimit, {
    global: true,
    max: 100,
    timeWindow: '1 minute',
    redis,
  });
}

export const limiteAutenticacao = {
  config: {
    rateLimit: {
      max: 5,
      timeWindow: '1 minute',
    },
  },
};
