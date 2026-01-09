import { supabase } from '../lib/supabase.js';
import { Message, DBMessage, ToolCall, ToolResult, ThinkingEntry } from '../types/index.js';

/**
 * Repository for message database operations
 */
export class MessageRepository {
  /**
   * Create a new message
   */
  async create(data: {
    conversationId: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    agentId?: string;
    toolCalls?: ToolCall[];
    toolResults?: ToolResult[];
    thinkingEntries?: ThinkingEntry[];
    artifactIds?: string[];
    inputTokens?: number;
    outputTokens?: number;
    metadata?: Record<string, any>;
  }): Promise<Message> {
    // Get next message order
    const { count } = await supabase
      .from('marketerx_messages')
      .select('*', { count: 'exact', head: true })
      .eq('conversation_id', data.conversationId);

    const messageOrder = (count || 0) + 1;

    const { data: message, error } = await supabase
      .from('marketerx_messages')
      .insert({
        conversation_id: data.conversationId,
        role: data.role,
        content: data.content,
        agent_id: data.agentId,
        tool_calls: data.toolCalls || [],
        tool_results: data.toolResults || [],
        thinking_entries: data.thinkingEntries || [],
        artifact_ids: data.artifactIds || [],
        input_tokens: data.inputTokens,
        output_tokens: data.outputTokens,
        metadata: data.metadata || {},
        message_order: messageOrder,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create message: ${error.message}`);
    return this.mapToMessage(message);
  }

  /**
   * Get messages by conversation ID
   */
  async getByConversationId(
    conversationId: string,
    options?: {
      limit?: number;
      offset?: number;
    }
  ): Promise<Message[]> {
    let query = supabase
      .from('marketerx_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('message_order', { ascending: true });

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
    }

    const { data, error } = await query;

    if (error) throw new Error(`Failed to get messages: ${error.message}`);
    return data.map((m) => this.mapToMessage(m));
  }

  /**
   * Get message by ID
   */
  async getById(id: string): Promise<Message | null> {
    const { data, error } = await supabase
      .from('marketerx_messages')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`Failed to get message: ${error.message}`);
    }

    return this.mapToMessage(data);
  }

  /**
   * Update message (useful for adding embeddings later)
   */
  async update(
    id: string,
    data: {
      embedding?: number[];
      metadata?: Record<string, any>;
    }
  ): Promise<Message> {
    const updateData: any = {};
    if (data.embedding) updateData.embedding = data.embedding;
    if (data.metadata) updateData.metadata = data.metadata;

    const { data: message, error } = await supabase
      .from('marketerx_messages')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`Failed to update message: ${error.message}`);
    return this.mapToMessage(message);
  }

  /**
   * Delete message
   */
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('marketerx_messages')
      .delete()
      .eq('id', id);

    if (error) throw new Error(`Failed to delete message: ${error.message}`);
  }

  /**
   * Get conversation context (recent messages)
   */
  async getConversationContext(
    conversationId: string,
    limit: number = 20
  ): Promise<Message[]> {
    const { data, error } = await supabase
      .from('marketerx_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('message_order', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`Failed to get conversation context: ${error.message}`);
    
    // Reverse to get chronological order
    return data.reverse().map((m) => this.mapToMessage(m));
  }

  /**
   * Map database record to domain model
   */
  private mapToMessage(data: DBMessage): Message {
    return {
      id: data.id,
      conversationId: data.conversation_id,
      role: data.role,
      content: data.content,
      agentId: data.agent_id || undefined,
      toolCalls: data.tool_calls as ToolCall[] || undefined,
      toolResults: data.tool_results as ToolResult[] || undefined,
      thinkingEntries: data.thinking_entries as ThinkingEntry[] || undefined,
      artifactIds: data.artifact_ids || undefined,
      metadata: data.metadata || undefined,
      inputTokens: data.input_tokens || undefined,
      outputTokens: data.output_tokens || undefined,
      createdAt: new Date(data.created_at),
    };
  }
}

export const messageRepository = new MessageRepository();


