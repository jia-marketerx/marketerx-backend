/**
 * Canon Repository
 * 
 * Handles database operations for canon data
 */

import { supabase } from '../lib/supabase.js';
import type { Canon, CanonFetchOptions, CanonSearchOptions } from '../types/canon.js';

export class CanonRepository {
  /**
   * Fetch canons by category and content type
   */
  static async fetchCanons(options: CanonFetchOptions): Promise<Canon[]> {
    let query = supabase
      .from('marketerx_canons')
      .select('*')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });

    // Filter by category
    if (options.category && options.category !== 'all') {
      query = query.eq('category', options.category);
    }

    // Filter by content type
    if (options.contentType) {
      query = query.eq('content_type', options.contentType);
    }

    // Filter by active status
    if (!options.includeInactive) {
      query = query.eq('is_active', true);
    }

    // Limit results
    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error('❌ Error fetching canons:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Search canons by semantic similarity
   */
  static async searchCanons(options: CanonSearchOptions): Promise<Canon[]> {
    // TODO: Implement vector search once embeddings are generated
    // For now, use text search
    let query = supabase
      .from('marketerx_canons')
      .select('*')
      .textSearch('search_content', options.query, {
        type: 'websearch',
        config: 'english',
      })
      .eq('is_active', true)
      .order('priority', { ascending: false });

    if (options.contentType) {
      query = query.eq('content_type', options.contentType);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error('❌ Error searching canons:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Get canon by ID
   */
  static async getCanonById(id: string): Promise<Canon | null> {
    const { data, error } = await supabase
      .from('marketerx_canons')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('❌ Error fetching canon by ID:', error);
      return null;
    }

    return data;
  }

  /**
   * Get high-priority canons for a content type (for early loading)
   */
  static async getHighPriorityCanons(
    contentType: CanonFetchOptions['contentType'],
    minPriority: number = 8
  ): Promise<Canon[]> {
    let query = supabase
      .from('marketerx_canons')
      .select('*')
      .eq('is_active', true)
      .gte('priority', minPriority)
      .order('priority', { ascending: false });

    if (contentType) {
      query = query.eq('content_type', contentType);
    }

    const { data, error } = await query;

    if (error) {
      console.error('❌ Error fetching high-priority canons:', error);
      throw error;
    }

    return data || [];
  }
}

