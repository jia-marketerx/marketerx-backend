import { Tier1Orchestrator } from '../agents/tier1-orchestrator.js';
import { AgentState } from '../agents/types.js';
import { Message } from '../types/index.js';
import { SSEStream } from '../utils/sse.js';
import { logger } from '../utils/logger.js';

/**
 * Agent service for managing AI agent workflow
 */
export class AgentService {
  /**
   * Process chat with AI agents
   */
  async processWithAgents(
    conversationId: string,
    userId: string,
    businessProfileId: string,
    userMessage: string,
    conversationContext: Message[],
    stream: SSEStream
  ): Promise<{
    response: string;
    tokensUsed?: { input: number; output: number };
    modelUsed?: string;
  }> {
    try {
      // Initialize agent state
      const state: AgentState = {
        conversationId,
        userId,
        businessProfileId,
        messages: [],
        currentUserMessage: userMessage,
        conversationContext,
        toolCalls: [],
        toolResults: [],
        thinking: [],
        response: '',
      };

      logger.info('Agent processing started', {
        conversationId,
        messageLength: userMessage.length,
        contextLength: conversationContext.length,
      });

      // Run Tier 1 orchestrator
      const orchestrator = new Tier1Orchestrator(stream);
      const resultState = await orchestrator.run(state);

      logger.info('Agent processing completed', {
        conversationId,
        responseLength: resultState.response.length,
        tokensUsed: resultState.tokensUsed,
      });

      return {
        response: resultState.response,
        tokensUsed: resultState.tokensUsed,
        modelUsed: resultState.modelUsed,
      };
    } catch (error) {
      logger.error('Agent processing error', error);
      throw error;
    }
  }
}

export const agentService = new AgentService();

