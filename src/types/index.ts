/**
 * Core TypeScript types for MarketerX Chat System
 */

// ============================================
// Conversation & Message Types
// ============================================

export interface Conversation {
  id: string;
  userId: string;
  businessProfileId: string;
  title?: string;
  status: 'active' | 'archived';
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt?: Date;
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  agentId?: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  thinkingEntries?: ThinkingEntry[];
  artifactIds?: string[];
  metadata?: Record<string, any>;
  inputTokens?: number;
  outputTokens?: number;
  createdAt: Date;
}

export interface ThinkingEntry {
  type: 'agent_reasoning' | 'tool_status' | 'analysis';
  content: string;
  timestamp: Date;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, any>;
}

export interface ToolResult {
  toolCallId: string;
  output: any;
  isError?: boolean;
}

// ============================================
// SSE Event Types
// ============================================

export type SSEEvent =
  | ThinkingEvent
  | AnalysisEvent
  | ArtifactEvent
  | MessageEvent
  | ErrorEvent
  | DoneEvent;

export interface ThinkingEvent {
  event: 'thinking';
  data: {
    type: 'agent_reasoning' | 'tool_status';
    content: string;
    tool?: string;
    metadata?: Record<string, any>;
  };
}

export interface AnalysisEvent {
  event: 'analysis';
  data: {
    type: 'research_summary' | 'knowledge_summary';
    content: string;
    sources?: any[];
    metadata?: Record<string, any>;
  };
}

export interface ArtifactEvent {
  event: 'artifact';
  data: {
    type: 'start' | 'delta' | 'end';
    artifactId: string;
    content?: string;
    metadata?: {
      contentType: string;
      wordCount?: number;
    };
  };
}

export interface MessageEvent {
  event: 'message';
  data: {
    role: 'assistant';
    content: string;
    messageId: string;
  };
}

export interface ErrorEvent {
  event: 'error';
  data: {
    error: string;
    code?: string;
    details?: any;
  };
}

export interface DoneEvent {
  event: 'done';
  data: {
    conversationId: string;
    messageCount: number;
  };
}

// ============================================
// API Request/Response Types
// ============================================

export interface ChatStreamRequest {
  conversationId?: string;
  message: string;
  modelPreference?: {
    tier1?: string;
    tier2?: string;
  };
  context?: {
    includeResources?: string[];
    enableWebSearch?: boolean;
    enableCodeExecution?: boolean;
  };
}

export interface ChatStreamResponse {
  stream: AsyncIterable<SSEEvent>;
}

// ============================================
// Tool Types
// ============================================

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };
}

export interface WebSearchInput {
  query: string;
  maxResults?: number;
  searchDepth?: 'basic' | 'advanced';
}

export interface KnowledgeSearchInput {
  query: string;
  topK?: number;
  resourceTypes?: string[];
}

export interface KnowledgeFetchInput {
  resourceId: string;
}

export interface FetchCanonInput {
  category: 'template' | 'framework' | 'compliance' | 'all';
  contentType: 'email' | 'ad' | 'landing-page' | 'script';
}

export interface ContentExecutionInput {
  contentType: 'email' | 'ad' | 'landing-page' | 'script';
  objective: string;
  targetAudience: string;
  brandGuidelines?: string;
  templates?: any[];
  complianceRules?: any[];
  research?: string;
  tone?: string;
}

// ============================================
// LangGraph State Types
// ============================================

export interface ChatState {
  conversationId: string;
  userId: string;
  businessProfileId: string;
  messages: Message[];
  currentMessage: string;
  toolCalls: ToolCall[];
  toolResults: ToolResult[];
  canon?: any;
  knowledgeResults?: any[];
  researchResults?: any[];
  artifacts: string[];
  metadata: Record<string, any>;
}

// ============================================
// Database Types
// ============================================

export interface DBConversation {
  id: string;
  user_id: string;
  business_profile_id: string;
  title: string | null;
  status: 'active' | 'archived';
  created_at: string;
  updated_at: string;
  last_message_at: string | null;
}

export interface DBMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  agent_id: string | null;
  tool_calls: any | null;
  tool_results: any | null;
  thinking_entries: any | null;
  artifact_ids: string[] | null;
  metadata: any | null;
  input_tokens: number | null;
  output_tokens: number | null;
  created_at: string;
}

// ============================================
// Cache Types
// ============================================

export interface CacheEntry<T = any> {
  key: string;
  value: T;
  ttl: number;
}

// ============================================
// Error Types
// ============================================

export class ChatError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'ChatError';
  }
}

