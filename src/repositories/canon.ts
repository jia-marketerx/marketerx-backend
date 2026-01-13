/**
 * Canon Repository
 * Database operations for canon items
 */

import { supabase } from '../lib/supabase.js';
import { logger } from '../utils/logger.js';

export interface CanonItem {
  id: string;
  business_profile_id: string;
  category_id: string;
  title: string;
  slug: string;
  description?: string;
  content_type: 'email' | 'ad' | 'landing-page' | 'script' | 'universal';
  content: any; // JSONB
  tags?: string[];
  priority: number;
  version: number;
  is_active: boolean;
  usage_count: number;
  last_used_at?: string;
  embedding?: number[];
  created_at: string;
  updated_at: string;
}

export interface CanonCategory {
  id: string;
  name: string;
  description?: string;
  sort_order: number;
  is_active: boolean;
}

export class CanonRepository {
  /**
   * Get all active canon categories
   */
  async getCategories(): Promise<CanonCategory[]> {
    const { data, error } = await supabase
      .from('canon_categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');

    if (error) {
      logger.error('Error fetching canon categories:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Get canon category by name
   */
  async getCategoryByName(name: string): Promise<CanonCategory | null> {
    const { data, error } = await supabase
      .from('canon_categories')
      .select('*')
      .eq('name', name)
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      logger.error('Error fetching canon category:', error);
      throw error;
    }

    return data;
  }

  /**
   * Get canon items by business profile and content type
   */
  async getCanonItems(
    businessProfileId: string,
    contentType?: string,
    categoryId?: string
  ): Promise<CanonItem[]> {
    let query = supabase
      .from('canon_items')
      .select('*')
      .eq('business_profile_id', businessProfileId)
      .eq('is_active', true)
      .order('priority', { ascending: false });

    // Filter by content type (including universal)
    if (contentType) {
      query = query.or(`content_type.eq.${contentType},content_type.eq.universal`);
    }

    // Filter by category
    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Error fetching canon items:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Get canon item by slug
   */
  async getCanonBySlug(
    businessProfileId: string,
    slug: string
  ): Promise<CanonItem | null> {
    const { data, error } = await supabase
      .from('canon_items')
      .select('*')
      .eq('business_profile_id', businessProfileId)
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      logger.error('Error fetching canon by slug:', error);
      throw error;
    }

    return data;
  }

  /**
   * Search canon items by similarity (vector search)
   */
  async searchBySimilarity(
    businessProfileId: string,
    queryEmbedding: number[],
    options: {
      contentType?: string;
      categoryId?: string;
      limit?: number;
    } = {}
  ): Promise<Array<CanonItem & { similarity: number }>> {
    const { contentType, categoryId, limit = 5 } = options;

    const { data, error } = await supabase.rpc('search_canon_by_similarity', {
      p_business_profile_id: businessProfileId,
      p_query_embedding: queryEmbedding,
      p_content_type: contentType || null,
      p_category_id: categoryId || null,
      p_limit: limit,
    });

    if (error) {
      logger.error('Error searching canon by similarity:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Create canon item
   */
  async createCanonItem(item: Omit<CanonItem, 'id' | 'created_at' | 'updated_at'>): Promise<CanonItem> {
    const { data, error } = await supabase
      .from('canon_items')
      .insert(item)
      .select()
      .single();

    if (error) {
      logger.error('Error creating canon item:', error);
      throw error;
    }

    return data;
  }

  /**
   * Update canon item
   */
  async updateCanonItem(
    id: string,
    updates: Partial<CanonItem>
  ): Promise<CanonItem> {
    const { data, error } = await supabase
      .from('canon_items')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('Error updating canon item:', error);
      throw error;
    }

    return data;
  }

  /**
   * Delete canon item (soft delete by setting is_active = false)
   */
  async deleteCanonItem(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('canon_items')
      .update({ is_active: false })
      .eq('id', id);

    if (error) {
      logger.error('Error deleting canon item:', error);
      throw error;
    }

    return true;
  }

  /**
   * Log canon usage
   */
  async logUsage(
    canonItemId: string,
    businessProfileId: string,
    conversationId: string | null,
    context: {
      contentType: string;
      userQuery?: string;
      wasCached?: boolean;
      loadTimeMs?: number;
    }
  ): Promise<void> {
    const { error } = await supabase.from('canon_usage_log').insert({
      canon_item_id: canonItemId,
      business_profile_id: businessProfileId,
      conversation_id: conversationId,
      content_type: context.contentType,
      user_query: context.userQuery,
      was_cached: context.wasCached || false,
      load_time_ms: context.loadTimeMs,
    });

    if (error) {
      logger.error('Error logging canon usage:', error);
      // Don't throw - this is just for analytics
    }
  }

  /**
   * Bulk update embeddings
   */
  async updateEmbeddings(
    updates: Array<{ id: string; embedding: number[] }>
  ): Promise<void> {
    for (const { id, embedding } of updates) {
      await supabase
        .from('canon_items')
        .update({ embedding })
        .eq('id', id);
    }
  }
}

// Singleton instance
export const canonRepository = new CanonRepository();

