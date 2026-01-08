import { supabase } from '../lib/supabase.js';
import { Conversation, DBConversation } from '../types/index.js';

/**
 * Repository for conversation database operations
 */
export class ConversationRepository {
  /**
   * Create a new conversation
   */
  async create(data: {
    userId: string;
    businessProfileId: string;
    title?: string;
    tier1Model?: string;
    tier2Model?: string;
  }): Promise<Conversation> {
    const { data: conversation, error } = await supabase
      .from('marketerx_conversations')
      .insert({
        user_id: data.userId,
        business_profile_id: data.businessProfileId,
        title: data.title,
        tier1_model: data.tier1Model,
        tier2_model: data.tier2Model,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create conversation: ${error.message}`);
    return this.mapToConversation(conversation);
  }

  /**
   * Get conversation by ID
   */
  async getById(id: string): Promise<Conversation | null> {
    const { data, error } = await supabase
      .from('marketerx_conversations')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`Failed to get conversation: ${error.message}`);
    }

    return this.mapToConversation(data);
  }

  /**
   * Get all conversations for a user
   */
  async getByUserId(
    userId: string,
    options?: {
      status?: 'active' | 'archived';
      limit?: number;
      offset?: number;
    }
  ): Promise<Conversation[]> {
    let query = supabase
      .from('marketerx_conversations')
      .select('*')
      .eq('user_id', userId)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (options?.status) {
      query = query.eq('status', options.status);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }

    const { data, error } = await query;

    if (error) throw new Error(`Failed to get conversations: ${error.message}`);
    return data.map((c) => this.mapToConversation(c));
  }

  /**
   * Update conversation
   */
  async update(
    id: string,
    data: {
      title?: string;
      status?: 'active' | 'archived';
    }
  ): Promise<Conversation> {
    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.status !== undefined) updateData.status = data.status;

    const { data: conversation, error } = await supabase
      .from('marketerx_conversations')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`Failed to update conversation: ${error.message}`);
    return this.mapToConversation(conversation);
  }

  /**
   * Delete conversation
   */
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('marketerx_conversations')
      .delete()
      .eq('id', id);

    if (error) throw new Error(`Failed to delete conversation: ${error.message}`);
  }

  /**
   * Map database record to domain model
   */
  private mapToConversation(data: DBConversation): Conversation {
    return {
      id: data.id,
      userId: data.user_id,
      businessProfileId: data.business_profile_id,
      title: data.title || undefined,
      status: data.status,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      lastMessageAt: data.last_message_at ? new Date(data.last_message_at) : undefined,
    };
  }
}

export const conversationRepository = new ConversationRepository();

