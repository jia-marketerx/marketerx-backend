import { Message } from '../types/index.js';

/**
 * LangGraph state for Tier 1 orchestrator
 */
export interface AgentState {
  conversationId: string;
  userId: string;
  businessProfileId: string;
  messages: Message[];
  currentUserMessage: string;
  
  // Tool execution tracking
  toolCalls: ToolCallInfo[];
  toolResults: ToolResultInfo[];
  
  // Knowledge and context
  conversationContext: Message[];
  knowledgeResults?: any[];
  researchResults?: any[];
  canonData?: any;
  
  // Response building
  thinking: string[];
  response: string;
  
  // Metadata
  modelUsed?: string;
  tokensUsed?: {
    input: number;
    output: number;
  };
  error?: string;
}

export interface ToolCallInfo {
  id: string;
  name: string;
  input: any;
  timestamp: Date;
}

export interface ToolResultInfo {
  toolCallId: string;
  output: any;
  isError: boolean;
  timestamp: Date;
}

/**
 * Tool function signature
 */
export type ToolFunction = (input: any, state: AgentState) => Promise<any>;

/**
 * Agent configuration
 */
export interface AgentConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  tools: ToolDefinition[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };
}

