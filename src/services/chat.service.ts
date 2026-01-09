import { conversationService } from './conversation.service.js';
import { messageRepository } from '../repositories/messages.js';
import { SSEStream } from '../utils/sse.js';
import { ChatStreamRequest, Message, ChatError } from '../types/index.js';
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

      // 4. Process with AI (mock for now - will be replaced with LangGraph)
      stream.thinking('agent_reasoning', 'Analyzing your request...');
      
      // Simulate thinking delay
      await this.delay(500);

      // Mock response (Phase 4 will replace this with real LangGraph orchestration)
      const mockResponse = this.generateMockResponse(request.message, context);

      // Stream mock response
      stream.thinking('agent_reasoning', 'Generating response...');
      
      // Simulate streaming chunks
      const chunks = this.splitIntoChunks(mockResponse, 20);
      
      stream.message('', 'streaming-start');
      
      for (const chunk of chunks) {
        stream.send({
          event: 'message',
          data: {
            role: 'assistant',
            content: chunk,
            messageId: 'streaming',
          },
        });
        await this.delay(50); // Simulate streaming delay
      }

      // 5. Save assistant message
      const assistantMessage = await messageRepository.create({
        conversationId,
        role: 'assistant',
        content: mockResponse,
        agentId: 'mock_agent',
        metadata: {
          modelUsed: 'mock',
          contextLength: context.length,
        },
      });

      logger.info('Assistant message saved', {
        conversationId,
        messageId: assistantMessage.id,
        contentLength: mockResponse.length,
      });

      // 6. Send completion
      stream.message(mockResponse, assistantMessage.id);
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

  /**
   * Generate mock response (will be replaced with real AI in Phase 4)
   */
  private generateMockResponse(userMessage: string, context: Message[]): string {
    const responseTemplates = [
      `Thank you for your message! You said: "${userMessage}". This is a mock response. In Phase 4, I'll be powered by Claude and LangGraph to provide intelligent marketing assistance.`,
      
      `I understand you're interested in: "${userMessage}". Currently, I'm in development mode. Once Phase 4 is complete, I'll be able to help you with content creation, research, and strategic marketing advice using advanced AI capabilities.`,
      
      `Got it! Your message was: "${userMessage}". I'm a placeholder response for now. Soon, I'll leverage Claude 3.5 Sonnet for strategic thinking and Haiku for rapid content generation.`,
    ];

    // Simple logic to vary responses
    const index = context.length % responseTemplates.length;
    return responseTemplates[index];
  }

  /**
   * Split text into chunks for streaming simulation
   */
  private splitIntoChunks(text: string, chunkSize: number): string[] {
    const words = text.split(' ');
    const chunks: string[] = [];
    
    for (let i = 0; i < words.length; i += chunkSize) {
      chunks.push(words.slice(i, i + chunkSize).join(' ') + ' ');
    }
    
    return chunks;
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const chatService = new ChatService();

