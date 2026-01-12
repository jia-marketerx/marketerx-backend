import { anthropic } from '../lib/anthropic.js';
import { config } from '../config/env.js';
import { AgentState, AgentConfig, ToolCallInfo, ToolResultInfo } from './types.js';
import { SSEStream } from '../utils/sse.js';
import { logger } from '../utils/logger.js';
import Anthropic from '@anthropic-ai/sdk';

/**
 * Tier 1 Orchestrator Agent
 * Uses Claude 3.5 Sonnet for strategic thinking and tool coordination
 */
export class Tier1Orchestrator {
  private config: AgentConfig;
  private stream: SSEStream;

  constructor(stream: SSEStream) {
    this.stream = stream;
    this.config = {
      model: config.models.tier1,
      temperature: 0.7,
      maxTokens: 4096,
      systemPrompt: this.buildSystemPrompt(),
      tools: this.getToolDefinitions(),
    };
  }

  /**
   * Run the orchestrator agent
   */
  async run(state: AgentState): Promise<AgentState> {
    try {
      this.stream.thinking('agent_reasoning', 'Tier 1 orchestrator analyzing your request...');

      // Build messages for Claude
      const messages = this.buildMessages(state);

      logger.info('Tier 1 orchestrator starting', {
        conversationId: state.conversationId,
        messageCount: messages.length,
        toolsAvailable: this.config.tools.length,
      });

      // Call Claude with streaming
      const response = await anthropic.messages.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        system: this.config.systemPrompt,
        messages: messages,
        tools: this.config.tools.length > 0 ? this.config.tools : undefined,
        stream: true,
      });

      // Process streaming response
      let fullResponse = '';
      let currentThinking = '';
      const toolCalls: ToolCallInfo[] = [];
      let inputTokens = 0;
      let outputTokens = 0;

      for await (const event of response) {
        if (event.type === 'message_start') {
          inputTokens = event.message.usage.input_tokens;
        } else if (event.type === 'content_block_start') {
          if (event.content_block.type === 'text') {
            // Text content starting
          } else if (event.content_block.type === 'tool_use') {
            // Tool call starting
            this.stream.thinking('tool_status', `Calling tool: ${event.content_block.name}`);
          }
        } else if (event.type === 'content_block_delta') {
          if (event.delta.type === 'text_delta') {
            // Stream text chunks
            const chunk = event.delta.text;
            fullResponse += chunk;
            
            // Send streaming chunks to frontend
            this.stream.send({
              event: 'message',
              data: {
                role: 'assistant',
                content: chunk,
                messageId: 'streaming',
              },
            });
          } else if (event.delta.type === 'input_json_delta') {
            // Tool input being built (we'll process when complete)
          }
        } else if (event.type === 'content_block_stop') {
          // Content block finished
        } else if (event.type === 'message_delta') {
          outputTokens = event.usage.output_tokens;
        } else if (event.type === 'message_stop') {
          // Message complete
        }
      }

      // Update state with response
      state.response = fullResponse;
      state.tokensUsed = {
        input: inputTokens,
        output: outputTokens,
      };
      state.modelUsed = this.config.model;
      state.toolCalls = [...state.toolCalls, ...toolCalls];

      logger.info('Tier 1 orchestrator completed', {
        conversationId: state.conversationId,
        responseLength: fullResponse.length,
        tokensUsed: state.tokensUsed,
        toolCallsCount: toolCalls.length,
      });

      return state;
    } catch (error) {
      logger.error('Tier 1 orchestrator error', error);
      state.error = error instanceof Error ? error.message : 'Unknown error';
      throw error;
    }
  }

  /**
   * Build system prompt for Tier 1 agent
   */
  private buildSystemPrompt(): string {
    return `You are the Tier 1 Strategic Orchestrator for MarketerX, an AI-powered marketing content platform.

Your role:
- Understand user intent and marketing objectives
- Provide strategic marketing advice and insights
- Coordinate with tools to gather information (research, knowledge base)
- When content creation is needed, provide clear briefs for Tier 2 content agents
- Maintain conversation context and help users refine their marketing strategy

Capabilities:
- Access to user's business knowledge base (brand guidelines, research reports, etc.)
- Web search for real-time marketing trends and competitive intelligence
- Strategic marketing frameworks and templates
- Ability to call Tier 2 content execution agents for specific deliverables

Communication style:
- Professional yet conversational
- Strategic and data-driven
- Transparent about your reasoning process
- Proactive in suggesting marketing improvements

Current phase: Phase 4 (Basic orchestration)
Note: Tool calling and Tier 2 integration will be added in Phase 5-6.

For now, focus on:
1. Understanding the user's marketing needs
2. Providing strategic advice
3. Planning what content or research would be helpful
4. Engaging in marketing strategy discussions`;
  }

  /**
   * Build messages array for Claude API
   */
  private buildMessages(state: AgentState): Anthropic.MessageParam[] {
    const messages: Anthropic.MessageParam[] = [];

    // Add conversation context (historical messages)
    for (const msg of state.conversationContext) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({
          role: msg.role,
          content: msg.content,
        });
      }
    }

    // Add current user message
    messages.push({
      role: 'user',
      content: state.currentUserMessage,
    });

    return messages;
  }

  /**
   * Get tool definitions (Phase 5 will implement actual tools)
   */
  private getToolDefinitions(): any[] {
    // Phase 5 will add: web-search, knowledge-search, fetch-canon, content-execution
    return [];
  }
}

