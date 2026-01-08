import Fastify from 'fastify';
import { config } from './config/env.js';
import { logger } from './utils/logger.js';
import { healthRoutes } from './routes/health.js';

/**
 * Create and configure Fastify server
 */
export async function createServer() {
  const fastify = Fastify({
    logger: config.server.isDevelopment ? {
      level: 'debug',
      transport: {
        target: 'pino-pretty',
        options: {
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      },
    } : true,
  });

  // Global error handler
  fastify.setErrorHandler((error, request, reply) => {
    logger.error('Server error', {
      error: error.message,
      stack: error.stack,
      url: request.url,
      method: request.method,
    });

    reply.status(error.statusCode || 500).send({
      error: {
        message: config.server.isDevelopment ? error.message : 'Internal Server Error',
        code: error.code || 'INTERNAL_ERROR',
      },
    });
  });

  // Register routes
  await fastify.register(healthRoutes);

  // TODO: Register chat routes
  // await fastify.register(chatRoutes, { prefix: '/api/v1/chat' });

  return fastify;
}

