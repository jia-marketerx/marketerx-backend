import { conversationService } from './conversation.service.js';
import { messageRepository } from '../repositories/messages.js';
import { agentService } from './agent.service.js';
import { SSEStream } from '../utils/sse.js';
import { ChatStreamRequest, ChatError } from '../types/index.js';
import { logger } from '../utils/logger.js';

/**
 * Chat service for handling streaming chat interactions
 */
export class ChatService {
  /**
   * Process a chat message with streaming response
   */
  async processMessage(
    request: ChatStreamRequest,
    userId: string,
    businessProfileId: string,
    stream: SSEStream
  ): Promise<void> {
    try {
      // 1. Get or create conversation
      let conversationId = request.conversationId;
      let conversation;

      if (conversationId) {
        // Verify conversation exists and user has access
        conversation = await conversationService.getConversation(conversationId, userId);
      } else {
        // Create new conversation
        const result = await conversationService.createConversation({
          userId,
          businessProfileId,
          title: this.generateTitle(request.message),
        });
        conversation = result.conversation;
        conversationId = conversation.id;
      }

      // 2. Save user message
      stream.thinking('agent_reasoning', 'Saving your message...');
      
      const userMessage = await messageRepository.create({
        conversationId,
        role: 'user',
        content: request.message,
      });

      logger.info('User message saved', {
        conversationId,
        messageId: userMessage.id,
        contentLength: request.message.length,
      });

      // 3. Get conversation context
      stream.thinking('agent_reasoning', 'Loading conversation history...');
      
      const context = await messageRepository.getConversationContext(conversationId, 20);

      logger.info('Context loaded', {
        conversationId,
        messageCount: context.length,
      });

      // 4. Process with AI agents (Tier 1 Orchestrator)
      stream.thinking('agent_reasoning', 'Processing with AI agents...');
      
      const agentResult = await agentService.processWithAgents(
        conversationId,
        userId,
        businessProfileId,
        request.message,
        context,
        stream
      );

      // 5. Save assistant message
      const assistantMessage = await messageRepository.create({
        conversationId,
        role: 'assistant',
        content: agentResult.response,
        agentId: 'tier1_orchestrator',
        inputTokens: agentResult.tokensUsed?.input,
        outputTokens: agentResult.tokensUsed?.output,
        metadata: {
          modelUsed: agentResult.modelUsed,
          contextLength: context.length,
        },
      });

      logger.info('Assistant message saved', {
        conversationId,
        messageId: assistantMessage.id,
        contentLength: agentResult.response.length,
        tokensUsed: agentResult.tokensUsed,
      });

      // 6. Send completion
      stream.message(agentResult.response, assistantMessage.id);
      stream.done(conversationId, context.length + 2);

      logger.info('Chat interaction completed', {
        conversationId,
        userMessageId: userMessage.id,
        assistantMessageId: assistantMessage.id,
      });
    } catch (error) {
      logger.error('Chat processing error', error);
      
      if (error instanceof ChatError) {
        stream.error(error.message, error.code);
      } else {
        stream.error('An unexpected error occurred', 'CHAT_ERROR');
      }
    } finally {
      stream.close();
    }
  }

  /**
   * Generate a title from the first message
   */
  private generateTitle(message: string): string {
    const maxLength = 50;
    if (message.length <= maxLength) {
      return message;
    }
    return message.substring(0, maxLength - 3) + '...';
  }
}

export const chatService = new ChatService();

