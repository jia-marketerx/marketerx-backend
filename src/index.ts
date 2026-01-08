import { createServer } from './server.js';
import { config } from './config/env.js';
import { logger } from './utils/logger.js';
import { redis } from './lib/redis.js';

/**
 * Start the server
 */
async function start() {
  try {
    logger.info('🚀 Starting MarketerX Chat Backend...');

    // Create server
    const server = await createServer();

    // Connect to Redis
    await redis.connect();
    logger.info('✅ Redis connected');

    // Start listening
    await server.listen({
      port: config.server.port,
      host: config.server.host,
    });

    logger.info(`✅ Server listening on http://${config.server.host}:${config.server.port}`);
    logger.info(`📝 Environment: ${config.server.nodeEnv}`);
    logger.info(`🎯 Tier 1 Model: ${config.models.tier1}`);
    logger.info(`🎯 Tier 2 Model: ${config.models.tier2}`);

    // Graceful shutdown
    const signals = ['SIGINT', 'SIGTERM'] as const;
    signals.forEach((signal) => {
      process.on(signal, async () => {
        logger.info(`Received ${signal}, shutting down gracefully...`);
        await server.close();
        await redis.quit();
        process.exit(0);
      });
    });
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

// Start the server
start();

