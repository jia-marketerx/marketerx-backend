/**
 * Knowledge Repository
 * Database operations for business resources (knowledge base)
 */

import { supabase } from '../lib/supabase.js';
import { logger } from '../utils/logger.js';

export interface BusinessResource {
  id: string;
  business_profile_id: string;
  title: string;
  description?: string;
  resource_type: 'document' | 'guideline' | 'reference' | 'example' | 'asset';
  content_text?: string;
  file_url?: string;
  file_type?: string;
  file_size_bytes?: number;
  tags?: string[];
  source?: string;
  embedding?: number[];
  access_count: number;
  last_accessed_at?: string;
  is_indexed: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export class KnowledgeRepository {
  /**
   * Get all active resources for a business profile
   */
  async getResources(
    businessProfileId: string,
    resourceType?: string
  ): Promise<BusinessResource[]> {
    let query = supabase
      .from('business_resources')
      .select('*')
      .eq('business_profile_id', businessProfileId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (resourceType) {
      query = query.eq('resource_type', resourceType);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Error fetching resources:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Get resource by ID
   */
  async getResourceById(id: string): Promise<BusinessResource | null> {
    const { data, error } = await supabase
      .from('business_resources')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      logger.error('Error fetching resource:', error);
      throw error;
    }

    // Increment access count
    await this.incrementAccessCount(id);

    return data;
  }

  /**
   * Search resources by similarity (vector search)
   */
  async searchBySimilarity(
    businessProfileId: string,
    queryEmbedding: number[],
    options: {
      resourceType?: string;
      limit?: number;
    } = {}
  ): Promise<Array<BusinessResource & { similarity: number }>> {
    const { resourceType, limit = 5 } = options;

    const { data, error } = await supabase.rpc('search_resources_by_similarity', {
      p_business_profile_id: businessProfileId,
      p_query_embedding: queryEmbedding,
      p_resource_type: resourceType || null,
      p_limit: limit,
    });

    if (error) {
      logger.error('Error searching resources by similarity:', error);
      throw error;
    }

    // Increment access counts for returned resources
    if (data && data.length > 0) {
      const ids = data.map((r: any) => r.id);
      await this.incrementAccessCounts(ids);
    }

    return data || [];
  }

  /**
   * Create resource
   */
  async createResource(
    resource: Omit<BusinessResource, 'id' | 'created_at' | 'updated_at' | 'access_count' | 'is_indexed'>
  ): Promise<BusinessResource> {
    const { data, error } = await supabase
      .from('business_resources')
      .insert(resource)
      .select()
      .single();

    if (error) {
      logger.error('Error creating resource:', error);
      throw error;
    }

    return data;
  }

  /**
   * Update resource
   */
  async updateResource(
    id: string,
    updates: Partial<BusinessResource>
  ): Promise<BusinessResource> {
    const { data, error } = await supabase
      .from('business_resources')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('Error updating resource:', error);
      throw error;
    }

    return data;
  }

  /**
   * Delete resource (soft delete)
   */
  async deleteResource(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('business_resources')
      .update({ is_active: false })
      .eq('id', id);

    if (error) {
      logger.error('Error deleting resource:', error);
      throw error;
    }

    return true;
  }

  /**
   * Increment access count for a single resource
   */
  private async incrementAccessCount(id: string): Promise<void> {
    const { error } = await supabase.rpc('increment', {
      row_id: id,
      table_name: 'business_resources',
      column_name: 'access_count',
    });

    if (error) {
      // Try alternative update method
      await supabase
        .from('business_resources')
        .update({
          access_count: supabase.raw('access_count + 1'),
          last_accessed_at: new Date().toISOString(),
        })
        .eq('id', id);
    }
  }

  /**
   * Increment access counts for multiple resources
   */
  private async incrementAccessCounts(ids: string[]): Promise<void> {
    for (const id of ids) {
      await this.incrementAccessCount(id);
    }
  }

  /**
   * Get resources that need indexing (no embedding yet)
   */
  async getUnindexedResources(
    businessProfileId: string,
    limit: number = 10
  ): Promise<BusinessResource[]> {
    const { data, error } = await supabase
      .from('business_resources')
      .select('*')
      .eq('business_profile_id', businessProfileId)
      .eq('is_active', true)
      .eq('is_indexed', false)
      .limit(limit);

    if (error) {
      logger.error('Error fetching unindexed resources:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Mark resource as indexed with embedding
   */
  async markAsIndexed(id: string, embedding: number[]): Promise<void> {
    const { error } = await supabase
      .from('business_resources')
      .update({
        embedding,
        is_indexed: true,
      })
      .eq('id', id);

    if (error) {
      logger.error('Error marking resource as indexed:', error);
      throw error;
    }
  }

  /**
   * Bulk update embeddings
   */
  async updateEmbeddings(
    updates: Array<{ id: string; embedding: number[] }>
  ): Promise<void> {
    for (const { id, embedding } of updates) {
      await this.markAsIndexed(id, embedding);
    }
  }
}

// Singleton instance
export const knowledgeRepository = new KnowledgeRepository();

