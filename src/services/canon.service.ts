/**
 * Canon Service
 * 
 * High-level service for fetching and caching canon data
 * Canon is loaded early in the agent flow to guide tool usage
 */

import { CanonRepository } from '../repositories/canons.js';
import { CacheService, CacheLayer } from './cache.service.js';
import type { Canon, CanonFetchOptions, CanonContentType } from '../types/canon.js';
import { logger } from '../utils/logger.js';

export class CanonService {
  /**
   * Fetch canons with caching (cache-first strategy)
   */
  static async fetchCanons(options: CanonFetchOptions): Promise<Canon[]> {
    const cacheKey = this.buildCacheKey(options);

    return CacheService.getOrSet(
      CacheLayer.Canon,
      cacheKey,
      () => CanonRepository.fetchCanons(options)
    );
  }

  /**
   * Get high-priority canons for early loading (cache-first)
   */
  static async getHighPriorityCanons(
    contentType?: CanonContentType,
    minPriority: number = 8
  ): Promise<Canon[]> {
    const cacheKey = `high-priority:${contentType || 'all'}:${minPriority}`;

    return CacheService.getOrSet(
      CacheLayer.Canon,
      cacheKey,
      () => CanonRepository.getHighPriorityCanons(contentType, minPriority)
    );
  }

  /**
   * Search canons by query
   */
  static async searchCanons(query: string, contentType?: CanonContentType): Promise<Canon[]> {
    // Don't cache search results (queries are too variable)
    return CanonRepository.searchCanons({ query, contentType, limit: 10 });
  }

  /**
   * Get canon by ID (with caching)
   */
  static async getCanonById(id: string): Promise<Canon | null> {
    const cacheKey = `by-id:${id}`;

    return CacheService.getOrSet(
      CacheLayer.Canon,
      cacheKey,
      () => CanonRepository.getCanonById(id)
    );
  }

  /**
   * Warm cache by loading commonly used canons
   */
  static async warmCache(): Promise<void> {
    logger.info('🔥 Warming canon cache...');

    try {
      // Pre-load high-priority canons for common content types
      const contentTypes: CanonContentType[] = ['email', 'ad', 'landing-page', 'script'];

      await Promise.all(
        contentTypes.map((type) => this.getHighPriorityCanons(type, 8))
      );

      logger.info('✅ Canon cache warmed successfully');
    } catch (error) {
      logger.error('❌ Error warming canon cache:', error);
    }
  }

  /**
   * Clear canon cache (useful after data updates)
   */
  static async clearCache(): Promise<void> {
    await CacheService.clearLayer(CacheLayer.Canon);
    logger.info('✅ Canon cache cleared');
  }

  /**
   * Build cache key from options
   */
  private static buildCacheKey(options: CanonFetchOptions): string {
    const parts: string[] = [];

    if (options.category) {
      parts.push(`cat:${options.category}`);
    }

    if (options.contentType) {
      parts.push(`type:${options.contentType}`);
    }

    if (options.limit) {
      parts.push(`limit:${options.limit}`);
    }

    if (options.includeInactive) {
      parts.push('inactive');
    }

    return parts.length > 0 ? parts.join(':') : 'all';
  }

  /**
   * Format canons for AI consumption
   * Combines content, instructions, and metadata into a readable format
   */
  static formatForAI(canons: Canon[]): string {
    if (canons.length === 0) {
      return 'No canon guidance available.';
    }

    const formatted = canons.map((canon) => {
      const sections: string[] = [];

      // Header
      sections.push(`## ${canon.name}`);
      if (canon.description) {
        sections.push(canon.description);
      }

      sections.push(`**Category:** ${canon.category} | **Content Type:** ${canon.content_type} | **Priority:** ${canon.priority}`);

      // Instructions (most important for AI)
      if (canon.instructions) {
        sections.push('\n**Instructions:**');
        sections.push(canon.instructions);
      }

      // Content
      sections.push('\n**Content:**');
      sections.push('```json');
      sections.push(JSON.stringify(canon.content, null, 2));
      sections.push('```');

      return sections.join('\n');
    });

    return formatted.join('\n\n---\n\n');
  }
}

