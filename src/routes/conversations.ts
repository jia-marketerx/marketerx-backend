import { FastifyInstance } from 'fastify';
import { conversationService } from '../services/conversation.service.js';
import { ChatError } from '../types/index.js';

/**
 * Conversation management routes
 */
export async function conversationRoutes(fastify: FastifyInstance) {
  /**
   * Create a new conversation
   * POST /conversations
   */
  fastify.post('/conversations', async (request, reply) => {
    try {
      const { userId, businessProfileId, title, initialMessage } = request.body as {
        userId: string;
        businessProfileId: string;
        title?: string;
        initialMessage?: string;
      };

      if (!userId || !businessProfileId) {
        return reply.code(400).send({
          error: {
            message: 'userId and businessProfileId are required',
            code: 'INVALID_REQUEST',
          },
        });
      }

      const result = await conversationService.createConversation({
        userId,
        businessProfileId,
        title,
        initialMessage,
      });

      return reply.code(201).send(result);
    } catch (error) {
      if (error instanceof ChatError) {
        return reply.code(error.statusCode).send({
          error: {
            message: error.message,
            code: error.code,
          },
        });
      }
      throw error;
    }
  });

  /**
   * Get user's conversations
   * GET /conversations?userId=xxx&status=active&limit=10
   */
  fastify.get('/conversations', async (request, reply) => {
    try {
      const { userId, status, limit, offset } = request.query as {
        userId: string;
        status?: 'active' | 'archived';
        limit?: string;
        offset?: string;
      };

      if (!userId) {
        return reply.code(400).send({
          error: {
            message: 'userId is required',
            code: 'INVALID_REQUEST',
          },
        });
      }

      const conversations = await conversationService.getUserConversations(userId, {
        status,
        limit: limit ? parseInt(limit, 10) : undefined,
        offset: offset ? parseInt(offset, 10) : undefined,
      });

      return { conversations };
    } catch (error) {
      if (error instanceof ChatError) {
        return reply.code(error.statusCode).send({
          error: {
            message: error.message,
            code: error.code,
          },
        });
      }
      throw error;
    }
  });

  /**
   * Get conversation by ID with messages
   * GET /conversations/:id?userId=xxx
   */
  fastify.get('/conversations/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { userId } = request.query as { userId: string };

      if (!userId) {
        return reply.code(400).send({
          error: {
            message: 'userId is required',
            code: 'INVALID_REQUEST',
          },
        });
      }

      const result = await conversationService.getConversationWithMessages(id, userId);

      return result;
    } catch (error) {
      if (error instanceof ChatError) {
        return reply.code(error.statusCode).send({
          error: {
            message: error.message,
            code: error.code,
          },
        });
      }
      throw error;
    }
  });

  /**
   * Update conversation
   * PATCH /conversations/:id
   */
  fastify.patch('/conversations/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { userId, title, status } = request.body as {
        userId: string;
        title?: string;
        status?: 'active' | 'archived';
      };

      if (!userId) {
        return reply.code(400).send({
          error: {
            message: 'userId is required',
            code: 'INVALID_REQUEST',
          },
        });
      }

      const conversation = await conversationService.updateConversation(id, userId, {
        title,
        status,
      });

      return { conversation };
    } catch (error) {
      if (error instanceof ChatError) {
        return reply.code(error.statusCode).send({
          error: {
            message: error.message,
            code: error.code,
          },
        });
      }
      throw error;
    }
  });

  /**
   * Delete conversation
   * DELETE /conversations/:id?userId=xxx
   */
  fastify.delete('/conversations/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { userId } = request.query as { userId: string };

      if (!userId) {
        return reply.code(400).send({
          error: {
            message: 'userId is required',
            code: 'INVALID_REQUEST',
          },
        });
      }

      await conversationService.deleteConversation(id, userId);

      return reply.code(204).send();
    } catch (error) {
      if (error instanceof ChatError) {
        return reply.code(error.statusCode).send({
          error: {
            message: error.message,
            code: error.code,
          },
        });
      }
      throw error;
    }
  });
}

