import { FastifyInstance } from 'fastify';
import { testDatabaseConnection } from '../lib/supabase.js';
import { testRedisConnection } from '../lib/redis.js';
import { testAnthropicConnection } from '../lib/anthropic.js';
import { testOpenAIConnection } from '../lib/openai.js';

/**
 * Health check routes
 */
export async function healthRoutes(fastify: FastifyInstance) {
  // Basic health check
  fastify.get('/health', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  });

  // Detailed health check with dependencies
  fastify.get('/health/detailed', async (_request, reply) => {
    const dbHealthy = await testDatabaseConnection();
    const redisHealthy = await testRedisConnection();

    const isHealthy = dbHealthy && redisHealthy;

    return reply.code(isHealthy ? 200 : 503).send({
      status: isHealthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        database: dbHealthy ? 'ok' : 'error',
        redis: redisHealthy ? 'ok' : 'error',
      },
    });
  });
}

