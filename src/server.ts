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
    const err = error as Error & { statusCode?: number; code?: string };
    
    logger.error('Server error', {
      error: err.message,
      stack: err.stack,
      url: request.url,
      method: request.method,
    });

    reply.status(err.statusCode || 500).send({
      error: {
        message: config.server.isDevelopment ? err.message : 'Internal Server Error',
        code: err.code || 'INTERNAL_ERROR',
      },
    });
  });

  // Register routes
  await fastify.register(healthRoutes);
  
  // Register conversation routes
  const { conversationRoutes } = await import('./routes/conversations.js');
  await fastify.register(conversationRoutes, { prefix: '/api/v1' });

  // Register chat streaming routes
  const { chatRoutes } = await import('./routes/chat.js');
  await fastify.register(chatRoutes, { prefix: '/api/v1/chat' });

  return fastify;
}

