import { anthropic } from '../lib/anthropic.js';
import { config } from '../config/env.js';
import { AgentState, AgentConfig, ToolCallInfo, ToolResultInfo } from './types.js';
import { SSEStream } from '../utils/sse.js';
import { logger } from '../utils/logger.js';
import { toolDefinitions, toolExecutor } from './tools.js';
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
      const toolCalls: ToolCallInfo[] = [];
      const contentBlocks: any[] = [];
      let inputTokens = 0;
      let outputTokens = 0;
      let stopReason: string | null = null;

      for await (const event of response) {
        if (event.type === 'message_start') {
          inputTokens = event.message.usage.input_tokens;
        } else if (event.type === 'content_block_start') {
          contentBlocks[event.index] = { type: event.content_block.type };
          
          if (event.content_block.type === 'text') {
            contentBlocks[event.index].text = '';
          } else if (event.content_block.type === 'tool_use') {
            contentBlocks[event.index].id = event.content_block.id;
            contentBlocks[event.index].name = event.content_block.name;
            contentBlocks[event.index].input = {};
            this.stream.thinking('tool_status', `Calling tool: ${event.content_block.name}`);
          }
        } else if (event.type === 'content_block_delta') {
          if (event.delta.type === 'text_delta') {
            // Stream text chunks
            const chunk = event.delta.text;
            contentBlocks[event.index].text += chunk;
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
            // Tool input being built
            contentBlocks[event.index].input = {
              ...contentBlocks[event.index].input,
              ...JSON.parse(event.delta.partial_json),
            };
          }
        } else if (event.type === 'content_block_stop') {
          // Content block finished
        } else if (event.type === 'message_delta') {
          outputTokens = event.usage.output_tokens;
          stopReason = event.delta.stop_reason;
        } else if (event.type === 'message_stop') {
          // Message complete
        }
      }

      // If there were tool calls, execute them and continue the conversation
      if (stopReason === 'tool_use') {
        this.stream.thinking('tool_status', 'Processing tool calls...');
        
        for (const block of contentBlocks) {
          if (block.type === 'tool_use') {
            const toolCall: ToolCallInfo = {
              toolName: block.name,
              input: block.input,
              timestamp: Date.now(),
            };
            toolCalls.push(toolCall);

            // Execute tool
            const toolResult = await toolExecutor.execute(
              block.name,
              block.input,
              {
                businessProfileId: state.businessProfileId || '',
                conversationId: state.conversationId,
              }
            );

            const toolResultInfo: ToolResultInfo = {
              toolName: block.name,
              result: toolResult.data,
              success: toolResult.success,
              error: toolResult.error,
              timestamp: Date.now(),
            };
            state.toolResults.push(toolResultInfo);

            this.stream.thinking(
              'tool_status',
              `Tool ${block.name} completed ${toolResult.success ? 'successfully' : 'with errors'}`
            );

            // If tool provided formatted output, send it as analysis
            if (toolResult.data?.formatted) {
              const analysisType = block.name.includes('knowledge') ? 'knowledge_summary' :
                                   block.name.includes('web') ? 'research_summary' : 'knowledge_summary';
              
              this.stream.send({
                event: 'analysis',
                data: {
                  type: analysisType,
                  content: toolResult.data.formatted,
                },
              });
            }
          }
        }

        // Continue conversation with tool results
        // This would require another call to Claude with tool results, which we'll implement in a more sophisticated way later
        // For now, we'll just add the tool results to state
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

## Critical: Cache-First, Canon-Guided Architecture

When handling content creation requests, ALWAYS follow this workflow:

1. **Analyze Intent** - Understand what the user wants to create
2. **Fetch Canon EARLY** - Use fetch-canon tool immediately to load frameworks, templates, and compliance rules
   - Canon tells you WHAT to search for in the knowledge base
   - Canon guides your entire approach
3. **Knowledge Search (Canon-Guided)** - Use knowledge-search with queries informed by canon
   - Example: Canon says "look for copywriting handbook" → search for it
4. **Web Search (Optional)** - Only if real-time data is needed
5. **Synthesize & Create Brief** - Combine canon + knowledge + research
6. **Execute Content** - Call content-execution tool with comprehensive brief

## Available Tools

You have access to these tools:
- **fetch-canon**: Load proprietary frameworks, templates, compliance rules (USE THIS FIRST!)
- **knowledge-search**: Semantic search over user's business resources (guided by canon)
- **knowledge-fetch**: Get full content of specific resource by ID
- **web-search**: Real-time web search (optional, only when needed)
- **content-execution**: Generate content via Tier 2 agent (provide comprehensive brief)

Communication style:
- Professional yet conversational
- Strategic and data-driven
- Transparent about your reasoning process
- Stream your thinking so users see your workflow

Remember: Canon is your guide. Load it early, use it to direct your searches.`;
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
   * Get tool definitions
   */
  private getToolDefinitions(): any[] {
    return toolDefinitions;
  }
}

