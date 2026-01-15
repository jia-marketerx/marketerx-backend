import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';

export interface Artifact {
  id: string;
  conversationId: string;
  messageId?: string;
  userId: string;
  businessProfileId?: string;
  contentType: 'email' | 'ad' | 'landing-page' | 'script';
  title: string;
  content: string;
  metadata: ArtifactMetadata;
  createdAt: string;
  updatedAt: string;
}

export interface ArtifactMetadata {
  model: string;
  tokensUsed?: number;
  generationTimeMs?: number;
  validationStatus: 'passed' | 'failed' | 'warning';
  validationIssues?: string[];
  canonVersion?: string;
}

export interface CreateArtifactInput {
  conversationId: string;
  messageId?: string;
  userId: string;
  businessProfileId?: string;
  contentType: 'email' | 'ad' | 'landing-page' | 'script';
  title: string;
  content: string;
  metadata: ArtifactMetadata;
}

export class ArtifactRepository {
  /**
   * Create a new artifact
   */
  async create(input: CreateArtifactInput): Promise<Artifact> {
    const { data, error } = await supabase
      .from('marketerx_artifacts')
      .insert({
        conversation_id: input.conversationId,
        message_id: input.messageId,
        user_id: input.userId,
        business_profile_id: input.businessProfileId,
        content_type: input.contentType,
        title: input.title,
        content: input.content,
        metadata: input.metadata,
      })
      .select()
      .single();

    if (error) {
      logger.error('Failed to create artifact', { error });
      throw new Error(`Failed to create artifact: ${error.message}`);
    }

    return this.mapToArtifact(data);
  }

  /**
   * Get artifact by ID
   */
  async getById(artifactId: string): Promise<Artifact | null> {
    const { data, error } = await supabase
      .from('marketerx_artifacts')
      .select('*')
      .eq('id', artifactId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      logger.error('Failed to get artifact', { error, artifactId });
      throw new Error(`Failed to get artifact: ${error.message}`);
    }

    return this.mapToArtifact(data);
  }

  /**
   * Get all artifacts for a conversation
   */
  async getByConversationId(conversationId: string): Promise<Artifact[]> {
    const { data, error } = await supabase
      .from('marketerx_artifacts')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Failed to get artifacts by conversation', { error, conversationId });
      throw new Error(`Failed to get artifacts: ${error.message}`);
    }

    return data.map(this.mapToArtifact);
  }

  /**
   * Get all artifacts for a user
   */
  async getByUserId(userId: string, limit = 50): Promise<Artifact[]> {
    const { data, error } = await supabase
      .from('marketerx_artifacts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error('Failed to get artifacts by user', { error, userId });
      throw new Error(`Failed to get artifacts: ${error.message}`);
    }

    return data.map(this.mapToArtifact);
  }

  /**
   * Get artifacts by content type
   */
  async getByContentType(
    userId: string,
    contentType: 'email' | 'ad' | 'landing-page' | 'script',
    limit = 20
  ): Promise<Artifact[]> {
    const { data, error } = await supabase
      .from('marketerx_artifacts')
      .select('*')
      .eq('user_id', userId)
      .eq('content_type', contentType)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error('Failed to get artifacts by content type', { error, userId, contentType });
      throw new Error(`Failed to get artifacts: ${error.message}`);
    }

    return data.map(this.mapToArtifact);
  }

  /**
   * Update artifact content
   */
  async update(
    artifactId: string,
    updates: {
      title?: string;
      content?: string;
      metadata?: Partial<ArtifactMetadata>;
    }
  ): Promise<Artifact> {
    const updateData: any = {};

    if (updates.title) updateData.title = updates.title;
    if (updates.content) updateData.content = updates.content;
    if (updates.metadata) {
      // Merge metadata
      const existing = await this.getById(artifactId);
      if (existing) {
        updateData.metadata = { ...existing.metadata, ...updates.metadata };
      }
    }

    const { data, error } = await supabase
      .from('marketerx_artifacts')
      .update(updateData)
      .eq('id', artifactId)
      .select()
      .single();

    if (error) {
      logger.error('Failed to update artifact', { error, artifactId });
      throw new Error(`Failed to update artifact: ${error.message}`);
    }

    return this.mapToArtifact(data);
  }

  /**
   * Delete artifact
   */
  async delete(artifactId: string): Promise<void> {
    const { error } = await supabase
      .from('marketerx_artifacts')
      .delete()
      .eq('id', artifactId);

    if (error) {
      logger.error('Failed to delete artifact', { error, artifactId });
      throw new Error(`Failed to delete artifact: ${error.message}`);
    }
  }

  /**
   * Map database row to Artifact type
   */
  private mapToArtifact(data: any): Artifact {
    return {
      id: data.id,
      conversationId: data.conversation_id,
      messageId: data.message_id,
      userId: data.user_id,
      businessProfileId: data.business_profile_id,
      contentType: data.content_type,
      title: data.title,
      content: data.content,
      metadata: data.metadata,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }
}

