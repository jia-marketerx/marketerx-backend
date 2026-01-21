import { FastifyInstance } from 'fastify';
import { chatService } from '../services/chat.service.js';
import { SSEStream } from '../utils/sse.js';
import { ChatStreamRequest } from '../types/index.js';
import { logger } from '../utils/logger.js';

/**
 * Chat streaming routes
 */
export async function chatRoutes(fastify: FastifyInstance) {
  /**
   * Stream chat responses with SSE
   * POST /stream
   * 
   * Request body:
   * {
   *   conversationId?: string,
   *   message: string,
   *   userId: string,
   *   businessProfileId: string,
   *   modelPreference?: { tier1?: string, tier2?: string },
   *   context?: { includeResources?: string[], enableWebSearch?: boolean }
   * }
   */
  fastify.post('/stream', async (request, reply) => {
    try {
      const body = request.body as ChatStreamRequest & {
        userId: string;
        businessProfileId: string;
      };

      // Validate required fields
      if (!body.message) {
        return reply.code(400).send({
          error: {
            message: 'message is required',
            code: 'INVALID_REQUEST',
          },
        });
      }

      if (!body.userId) {
        return reply.code(400).send({
          error: {
            message: 'userId is required',
            code: 'INVALID_REQUEST',
          },
        });
      }

      if (!body.businessProfileId) {
        return reply.code(400).send({
          error: {
            message: 'businessProfileId is required',
            code: 'INVALID_REQUEST',
          },
        });
      }

      logger.info('Chat stream request received', {
        conversationId: body.conversationId,
        userId: body.userId,
        businessProfileId: body.businessProfileId,
        messageLength: body.message.length,
      });

      // Initialize SSE stream
      const stream = new SSEStream(reply);

      // Process chat message asynchronously
      // Don't await here - let it stream in background
      chatService.processMessage(
        {
          conversationId: body.conversationId,
          message: body.message,
          modelPreference: body.modelPreference,
          context: body.context,
        },
        body.userId,
        body.businessProfileId,
        stream
      ).catch((error) => {
        logger.error('Uncaught error in chat processing', error);
        stream.error('An unexpected error occurred', 'INTERNAL_ERROR');
        stream.close();
      });

      // Return immediately - streaming happens in background
      return reply.hijack();
    } catch (error) {
      logger.error('Chat route error', error);
      return reply.code(500).send({
        error: {
          message: 'Internal server error',
          code: 'INTERNAL_ERROR',
        },
      });
    }
  });

  /**
   * Get available models
   * GET /models
   */
  fastify.get('/models', async (_request, _reply) => {
    return {
      models: {
        tier1: [
          {
            id: 'claude-3-5-sonnet-20241022',
            name: 'Claude 3.5 Sonnet',
            description: 'Strategic orchestrator - Best for reasoning and planning',
            tier: 1,
            provider: 'anthropic',
          },
        ],
        tier2: [
          {
            id: 'claude-3-5-haiku-20241022',
            name: 'Claude 3.5 Haiku',
            description: 'Fast content generation',
            tier: 2,
            provider: 'anthropic',
          },
          {
            id: 'gpt-4o-mini',
            name: 'GPT-4o Mini',
            description: 'Alternative content generator',
            tier: 2,
            provider: 'openai',
          },
        ],
      },
    };
  });
}

