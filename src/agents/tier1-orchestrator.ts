import { anthropic } from '../lib/anthropic.js';
import { config } from '../config/env.js';
import { AgentState, AgentConfig } from './types.js';
import { SSEStream } from '../utils/sse.js';
import { logger } from '../utils/logger.js';
import Anthropic from '@anthropic-ai/sdk';
import { allTools, executeTool, type ToolExecutionContext } from './tools.js';

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
   * Run the orchestrator agent (with agentic loop for tool calling)
   */
  async run(state: AgentState): Promise<AgentState> {
    try {
      this.stream.thinking('agent_reasoning', 'Tier 1 orchestrator analyzing your request...');

      // Agentic loop: Keep calling Claude until no more tools are needed
      let continueLoop = true;
      let loopCount = 0;
      const maxLoops = 5; // Prevent infinite loops

      while (continueLoop && loopCount < maxLoops) {
        loopCount++;
        
        // Reset streaming flag for each iteration so each response creates a new block
        let streamingStarted = false;

        // Build messages for Claude
        const messages = this.buildMessages(state);

        logger.info('Tier 1 orchestrator iteration', {
          conversationId: state.conversationId,
          iteration: loopCount,
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
        const toolUseBlocks: any[] = [];
        const contentBlocks: any[] = [];
        let currentToolUse: any = null;
        let inputTokens = 0;
        let outputTokens = 0;
        let stopReason = '';

        for await (const event of response) {
          if (event.type === 'message_start') {
            inputTokens = event.message.usage.input_tokens;
          } else if (event.type === 'content_block_start') {
            if (event.content_block.type === 'text') {
              // Text content starting - send streaming-start event
              if (!streamingStarted) {
                this.stream.send({
                  event: 'message',
                  data: {
                    role: 'assistant',
                    content: '',
                    messageId: 'streaming-start',
                  },
                });
                streamingStarted = true;
              }
              contentBlocks.push({ type: 'text', text: '' });
            } else if (event.content_block.type === 'tool_use') {
              // Tool call starting
              this.stream.thinking('tool_status', `Preparing to call: ${event.content_block.name}`);
              currentToolUse = {
                id: event.content_block.id,
                name: event.content_block.name,
                input: {},
              };
              contentBlocks.push({
                type: 'tool_use',
                id: event.content_block.id,
                name: event.content_block.name,
              });
            }
          } else if (event.type === 'content_block_delta') {
            if (event.delta.type === 'text_delta') {
              // Stream text chunks
              const chunk = event.delta.text;
              fullResponse += chunk;

              // Update last text content block
              const lastBlock = contentBlocks[contentBlocks.length - 1];
              if (lastBlock && lastBlock.type === 'text') {
                lastBlock.text += chunk;
              }
              
              // Always stream chunks to frontend (all iterations)
              this.stream.send({
                event: 'message',
                data: {
                  role: 'assistant',
                  content: chunk,
                  messageId: 'streaming',
                },
              });
            } else if (event.delta.type === 'input_json_delta') {
              // Build tool input JSON
              if (currentToolUse) {
                try {
                  const partial = event.delta.partial_json || '';
                  currentToolUse.inputJson = (currentToolUse.inputJson || '') + partial;
                } catch (e) {
                  // Ignore parsing errors during streaming
                }
              }
            }
          } else if (event.type === 'content_block_stop') {
            // Content block finished
            if (currentToolUse) {
              try {
                currentToolUse.input = JSON.parse(currentToolUse.inputJson || '{}');
                delete currentToolUse.inputJson;
                
                // Add input to content block
                const lastBlock = contentBlocks[contentBlocks.length - 1];
                if (lastBlock && lastBlock.type === 'tool_use') {
                  lastBlock.input = currentToolUse.input;
                }
                
                toolUseBlocks.push(currentToolUse);
              } catch (e) {
                logger.error('Failed to parse tool input JSON:', e);
              }
              currentToolUse = null;
            }
          } else if (event.type === 'message_delta') {
            outputTokens = event.usage.output_tokens;
            if (event.delta.stop_reason) {
              stopReason = event.delta.stop_reason;
            }
          } else if (event.type === 'message_stop') {
            // Message complete
          }
        }

        // Update token usage
        state.tokensUsed = {
          input: (state.tokensUsed?.input || 0) + inputTokens,
          output: (state.tokensUsed?.output || 0) + outputTokens,
        };

        // Execute tools if any were called
        if (toolUseBlocks.length > 0 && stopReason === 'tool_use') {
          logger.info(`Executing ${toolUseBlocks.length} tool calls...`);
          
          // Execute tools and get results
          await this.processToolCalls(toolUseBlocks, state);

          // Check if content_execution was called - if so, we're done after this
          const hasContentExecution = toolUseBlocks.some(t => t.name === 'content_execution');
          const hasValidation = toolUseBlocks.some(t => t.name === 'validate_content');

          // Add assistant message with tool calls to conversation
          // Ensure we have content blocks
          if (contentBlocks.length > 0) {
            state.conversationContext.push({
              role: 'assistant',
              content: contentBlocks,
            } as any);
          }

          // Add tool results as user message for next iteration
          const toolResultsMessage: any = {
            role: 'user',
            content: state.toolResults.slice(-toolUseBlocks.length).map((result) => ({
              type: 'tool_result',
              tool_use_id: result.toolCallId,
              content: result.output || 'No output',
              is_error: result.isError,
            })),
          };

          state.conversationContext.push(toolResultsMessage);

          // If content_execution was called, allow ONE more iteration for validation or final response
          // If validation was called, stop immediately
          if (hasValidation || (hasContentExecution && loopCount >= 2)) {
            logger.info('Content generation complete, ending loop');
            state.response = fullResponse || 'Content generated successfully.';
            continueLoop = false;
          } else {
            // Continue loop to let agent process tool results
            continueLoop = true;
          }
        } else {
          // No more tools to call, we're done
          state.response = fullResponse;
          continueLoop = false;
        }

        logger.info('Tier 1 orchestrator iteration completed', {
          conversationId: state.conversationId,
          iteration: loopCount,
          responseLength: fullResponse.length,
          toolCallsCount: toolUseBlocks.length,
          stopReason,
          continueLoop,
        });
      }

      state.modelUsed = this.config.model;

      logger.info('Tier 1 orchestrator completed', {
        conversationId: state.conversationId,
        totalIterations: loopCount,
        finalResponseLength: state.response.length,
        totalTokensUsed: state.tokensUsed,
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

**CANON-FIRST WORKFLOW (CRITICAL):**

1. **Analyze Intent** - Understand what type of content the user needs (email, ad, landing page, etc.)

2. **Fetch Canon EARLY** - Immediately call \`fetch_canon\` to load:
   - Templates (structure/format guidance)
   - Frameworks (strategic models like AIDA, PAS)
   - Compliance rules (legal requirements, MUST be validated)
   
   Example: User wants email → fetch canon for category="all", contentType="email"
   
   WHY: Canon tells you WHAT to search for and HOW to generate content.

3. **Canon-Guided Knowledge Search** - Use canon instructions to search user's business resources:
   - If canon says "look for copywriting handbook" → search for it
   - If canon mentions "brand guidelines required" → fetch them
   - Use \`knowledge_search\` with queries informed by canon
   
4. **Optional Web Search** - Only if:
   - User explicitly requests current trends/data
   - Canon or knowledge suggests external research needed
   - Use \`web_search\` for real-time information

5. **Synthesize & Respond** - Combine canon + knowledge + web research to:
   - Answer strategic questions
   - Provide marketing advice
   - Build briefs for content generation (Phase 6)

**Available Tools:**
- \`fetch_canon\`: Load proprietary frameworks/templates/compliance (CALL FIRST!)
- \`knowledge_search\`: Search user's business resources (brand, offers, testimonials, etc.)
- \`web_search\`: Real-time web search for trends and research
- \`content_execution\`: Generate marketing content (email, ad, landing-page, script) - CALL AFTER gathering context
- \`validate_content\`: Validate content against canon rules and compliance

**Workflow for Content Generation (FOLLOW THIS ORDER):**
1. Load canon for content type (may return 0 rules - that's OK)
2. Search knowledge for brand/product info (optional - may return 0 results)
3. (Optional) Web search if user needs current data
4. **Call content_execution** with the best brief you can build
5. **AFTER content_execution succeeds**: 
   - If you have canon compliance rules → call validate_content
   - Otherwise → STOP calling tools and present the content to user
6. Present final content and validation results

**CRITICAL RULES:**
- Call each tool ONLY ONCE per request (don't repeat fetch_canon)
- After content_execution, ONLY call validate_content OR respond to user
- Don't loop back to earlier steps
- Don't get stuck! Proceed even with 0 results from canon/knowledge

**Communication Style:**
- Professional yet conversational
- Strategic and data-driven  
- Transparent about reasoning
- Cite sources when using canon/knowledge/web results

**Phase 6 Active:** Two-tier architecture with content generation and validation`;
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

    // Add current user message if not already in context
    // (Check if the last message is the current user message)
    const lastMessage = messages[messages.length - 1];
    const isCurrentMessageInContext =
      lastMessage &&
      lastMessage.role === 'user' &&
      typeof lastMessage.content === 'string' &&
      lastMessage.content === state.currentUserMessage;

    if (!isCurrentMessageInContext) {
      messages.push({
        role: 'user',
        content: state.currentUserMessage,
      });
    }

    return messages;
  }

  /**
   * Get tool definitions
   */
  private getToolDefinitions(): any[] {
    return allTools;
  }

  /**
   * Process tool calls from Claude response
   * This is a simplified version for Phase 5 - full agentic loop will be added later
   */
  private async processToolCalls(
    toolUseBlocks: any[],
    state: AgentState
  ): Promise<void> {
    const context: ToolExecutionContext = {
      businessProfileId: state.businessProfileId,
      userId: state.userId,
      conversationId: state.conversationId,
      messageId: state.messages.length > 0 ? state.messages[0].id : undefined,
      stream: this.stream,
    };

    for (const toolUse of toolUseBlocks) {
      const { id, name, input } = toolUse;

      this.stream.thinking('tool_status', `Executing ${name}...`);

      try {
        const result = await executeTool(name, input, context);

        // Track tool call and result in state
        state.toolCalls.push({
          id,
          name,
          input,
          timestamp: new Date(),
        });

        state.toolResults.push({
          toolCallId: id,
          output: result.content,
          isError: !result.success,
          timestamp: new Date(),
        });

        if (result.success) {
          this.stream.thinking('tool_status', `✅ ${name} completed`);
          
          // Send results as analysis events (so frontend can display them)
          if (name === 'fetch_canon') {
            this.stream.send({
              event: 'analysis',
              data: {
                type: 'canon_loaded',
                content: `Canon loaded: ${result.metadata?.count || 0} rules`,
              },
            });
          } else if (name === 'knowledge_search') {
            this.stream.send({
              event: 'analysis',
              data: {
                type: 'knowledge_summary',
                content: `Found ${result.metadata?.resultCount || 0} relevant resources`,
              },
            });
          } else if (name === 'web_search') {
            this.stream.send({
              event: 'analysis',
              data: {
                type: 'research_summary',
                content: result.metadata?.summary || 'Web search completed',
              },
            });
          } else if (name === 'content_execution') {
            this.stream.send({
              event: 'analysis',
              data: {
                type: 'content_generated',
                content: `✅ ${result.metadata?.title || 'Content'} generated (${result.metadata?.tokensUsed || 0} tokens)`,
              },
            });
          } else if (name === 'validate_content') {
            this.stream.send({
              event: 'analysis',
              data: {
                type: 'validation_complete',
                content: `Validation: ${result.metadata?.validationStatus || 'completed'}`,
              },
            });
          }
        } else {
          this.stream.thinking('tool_status', `❌ ${name} failed: ${result.error}`);
        }
      } catch (error: any) {
        logger.error(`Error executing tool ${name}:`, error);

        state.toolResults.push({
          toolCallId: id,
          output: `Error: ${error.message}`,
          isError: true,
          timestamp: new Date(),
        });

        this.stream.thinking('tool_status', `❌ ${name} error: ${error.message}`);
      }
    }
  }
}

