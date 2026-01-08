import { conversationRepository } from '../repositories/conversations.js';
import { messageRepository } from '../repositories/messages.js';
import { Conversation, Message } from '../types/index.js';
import { ChatError } from '../types/index.js';

/**
 * Service layer for conversation business logic
 */
export class ConversationService {
  /**
   * Create a new conversation
   */
  async createConversation(data: {
    userId: string;
    businessProfileId: string;
    title?: string;
    initialMessage?: string;
  }): Promise<{ conversation: Conversation; message?: Message }> {
    try {
      // Create conversation
      const conversation = await conversationRepository.create({
        userId: data.userId,
        businessProfileId: data.businessProfileId,
        title: data.title || 'New Conversation',
      });

      // Optionally create initial message
      let message: Message | undefined;
      if (data.initialMessage) {
        message = await messageRepository.create({
          conversationId: conversation.id,
          role: 'user',
          content: data.initialMessage,
        });
      }

      return { conversation, message };
    } catch (error) {
      throw new ChatError(
        'Failed to create conversation',
        'CONVERSATION_CREATE_ERROR',
        500,
        error
      );
    }
  }

  /**
   * Get conversation by ID
   */
  async getConversation(conversationId: string, userId: string): Promise<Conversation> {
    try {
      const conversation = await conversationRepository.getById(conversationId);

      if (!conversation) {
        throw new ChatError(
          'Conversation not found',
          'CONVERSATION_NOT_FOUND',
          404
        );
      }

      // Verify ownership
      if (conversation.userId !== userId) {
        throw new ChatError(
          'Unauthorized access to conversation',
          'CONVERSATION_UNAUTHORIZED',
          403
        );
      }

      return conversation;
    } catch (error) {
      if (error instanceof ChatError) throw error;
      throw new ChatError(
        'Failed to get conversation',
        'CONVERSATION_GET_ERROR',
        500,
        error
      );
    }
  }

  /**
   * Get conversation with messages
   */
  async getConversationWithMessages(
    conversationId: string,
    userId: string
  ): Promise<{ conversation: Conversation; messages: Message[] }> {
    const conversation = await this.getConversation(conversationId, userId);
    const messages = await messageRepository.getByConversationId(conversationId);

    return { conversation, messages };
  }

  /**
   * Get user's conversations
   */
  async getUserConversations(
    userId: string,
    options?: {
      status?: 'active' | 'archived';
      limit?: number;
      offset?: number;
    }
  ): Promise<Conversation[]> {
    try {
      return await conversationRepository.getByUserId(userId, options);
    } catch (error) {
      throw new ChatError(
        'Failed to get conversations',
        'CONVERSATIONS_GET_ERROR',
        500,
        error
      );
    }
  }

  /**
   * Update conversation
   */
  async updateConversation(
    conversationId: string,
    userId: string,
    data: {
      title?: string;
      status?: 'active' | 'archived';
    }
  ): Promise<Conversation> {
    // Verify ownership
    await this.getConversation(conversationId, userId);

    try {
      return await conversationRepository.update(conversationId, data);
    } catch (error) {
      throw new ChatError(
        'Failed to update conversation',
        'CONVERSATION_UPDATE_ERROR',
        500,
        error
      );
    }
  }

  /**
   * Delete conversation
   */
  async deleteConversation(conversationId: string, userId: string): Promise<void> {
    // Verify ownership
    await this.getConversation(conversationId, userId);

    try {
      await conversationRepository.delete(conversationId);
    } catch (error) {
      throw new ChatError(
        'Failed to delete conversation',
        'CONVERSATION_DELETE_ERROR',
        500,
        error
      );
    }
  }

  /**
   * Add message to conversation
   */
  async addMessage(
    conversationId: string,
    userId: string,
    data: {
      role: 'user' | 'assistant' | 'system';
      content: string;
      agentId?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<Message> {
    // Verify ownership
    await this.getConversation(conversationId, userId);

    try {
      return await messageRepository.create({
        conversationId,
        ...data,
      });
    } catch (error) {
      throw new ChatError(
        'Failed to add message',
        'MESSAGE_CREATE_ERROR',
        500,
        error
      );
    }
  }

  /**
   * Get conversation context for AI
   */
  async getConversationContext(
    conversationId: string,
    userId: string,
    limit: number = 20
  ): Promise<Message[]> {
    // Verify ownership
    await this.getConversation(conversationId, userId);

    try {
      return await messageRepository.getConversationContext(conversationId, limit);
    } catch (error) {
      throw new ChatError(
        'Failed to get conversation context',
        'CONTEXT_GET_ERROR',
        500,
        error
      );
    }
  }
}

export const conversationService = new ConversationService();

