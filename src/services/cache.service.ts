/**
 * Unified Cache Service
 * Handles all Redis caching operations with different TTLs for different data types
 */

import { redis } from '../lib/redis.js';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string; // Cache key prefix
}

export class CacheService {
  private readonly defaultTTL = 3600; // 1 hour

  // Cache key prefixes
  private readonly prefixes = {
    session: 'session:',
    canon: 'canon:',
    knowledge: 'knowledge:',
    prompt: 'prompt:',
    webSearch: 'web:',
  };

  // TTL configurations from environment
  private readonly ttls = {
    session: config.cache.ttl.session, // 30 minutes
    canon: config.cache.ttl.canon, // 7 days
    knowledge: config.cache.ttl.knowledge, // 24 hours
    prompt: 300, // 5 minutes (matches Anthropic prompt cache)
    webSearch: 3600, // 1 hour
  };

  /**
   * Generic get from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await redis.get(key);
      if (!data) return null;

      return JSON.parse(data) as T;
    } catch (error) {
      logger.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Generic set to cache
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<boolean> {
    try {
      const serialized = JSON.stringify(value);
      const finalTTL = ttl || this.defaultTTL;

      await redis.setex(key, finalTTL, serialized);
      return true;
    } catch (error) {
      logger.error('Cache set error:', error);
      return false;
    }
  }

  /**
   * Delete from cache
   */
  async delete(key: string): Promise<boolean> {
    try {
      await redis.del(key);
      return true;
    } catch (error) {
      logger.error('Cache delete error:', error);
      return false;
    }
  }

  /**
   * Delete multiple keys matching a pattern
   */
  async deletePattern(pattern: string): Promise<number> {
    try {
      const keys = await redis.keys(pattern);
      if (keys.length === 0) return 0;

      await redis.del(...keys);
      return keys.length;
    } catch (error) {
      logger.error('Cache delete pattern error:', error);
      return 0;
    }
  }

  // =====================================================
  // SESSION CACHING
  // =====================================================

  /**
   * Cache conversation context
   */
  async cacheSession(conversationId: string, data: any): Promise<boolean> {
    const key = `${this.prefixes.session}${conversationId}`;
    return this.set(key, data, this.ttls.session);
  }

  /**
   * Get cached conversation context
   */
  async getSession<T>(conversationId: string): Promise<T | null> {
    const key = `${this.prefixes.session}${conversationId}`;
    return this.get<T>(key);
  }

  /**
   * Update session TTL (extend expiration)
   */
  async extendSession(conversationId: string): Promise<boolean> {
    try {
      const key = `${this.prefixes.session}${conversationId}`;
      await redis.expire(key, this.ttls.session);
      return true;
    } catch (error) {
      logger.error('Cache extend session error:', error);
      return false;
    }
  }

  // =====================================================
  // CANON CACHING
  // =====================================================

  /**
   * Cache canon items by business profile and content type
   */
  async cacheCanon(
    businessProfileId: string,
    contentType: string,
    data: any
  ): Promise<boolean> {
    const key = `${this.prefixes.canon}${businessProfileId}:${contentType}`;
    return this.set(key, data, this.ttls.canon);
  }

  /**
   * Get cached canon items
   */
  async getCanon<T>(businessProfileId: string, contentType: string): Promise<T | null> {
    const key = `${this.prefixes.canon}${businessProfileId}:${contentType}`;
    return this.get<T>(key);
  }

  /**
   * Invalidate all canon cache for a business profile
   */
  async invalidateCanon(businessProfileId: string): Promise<number> {
    const pattern = `${this.prefixes.canon}${businessProfileId}:*`;
    return this.deletePattern(pattern);
  }

  // =====================================================
  // KNOWLEDGE SEARCH CACHING
  // =====================================================

  /**
   * Cache knowledge search results
   */
  async cacheKnowledge(
    businessProfileId: string,
    query: string,
    results: any
  ): Promise<boolean> {
    // Create a hash of the query for cache key
    const queryHash = this.hashString(query);
    const key = `${this.prefixes.knowledge}${businessProfileId}:${queryHash}`;
    return this.set(key, results, this.ttls.knowledge);
  }

  /**
   * Get cached knowledge search results
   */
  async getKnowledge<T>(businessProfileId: string, query: string): Promise<T | null> {
    const queryHash = this.hashString(query);
    const key = `${this.prefixes.knowledge}${businessProfileId}:${queryHash}`;
    return this.get<T>(key);
  }

  // =====================================================
  // WEB SEARCH CACHING
  // =====================================================

  /**
   * Cache web search results
   */
  async cacheWebSearch(query: string, results: any): Promise<boolean> {
    const queryHash = this.hashString(query);
    const key = `${this.prefixes.webSearch}${queryHash}`;
    return this.set(key, results, this.ttls.webSearch);
  }

  /**
   * Get cached web search results
   */
  async getWebSearch<T>(query: string): Promise<T | null> {
    const queryHash = this.hashString(query);
    const key = `${this.prefixes.webSearch}${queryHash}`;
    return this.get<T>(key);
  }

  // =====================================================
  // CACHE WARMING
  // =====================================================

  /**
   * Warm up cache for frequently accessed data
   */
  async warmCache(businessProfileId: string, data: {
    canon?: Record<string, any>;
    commonQueries?: Array<{ query: string; results: any }>;
  }): Promise<void> {
    try {
      // Cache canon items
      if (data.canon) {
        for (const [contentType, canonData] of Object.entries(data.canon)) {
          await this.cacheCanon(businessProfileId, contentType, canonData);
        }
      }

      // Cache common knowledge queries
      if (data.commonQueries) {
        for (const { query, results } of data.commonQueries) {
          await this.cacheKnowledge(businessProfileId, query, results);
        }
      }

      logger.info(`Cache warmed for business profile: ${businessProfileId}`);
    } catch (error) {
      logger.error('Cache warming error:', error);
    }
  }

  // =====================================================
  // HELPER METHODS
  // =====================================================

  /**
   * Simple string hash for cache keys
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    connected: boolean;
    keys: {
      session: number;
      canon: number;
      knowledge: number;
      webSearch: number;
    };
  }> {
    try {
      const connected = redis.status === 'ready';
      
      const keys = {
        session: (await redis.keys(`${this.prefixes.session}*`)).length,
        canon: (await redis.keys(`${this.prefixes.canon}*`)).length,
        knowledge: (await redis.keys(`${this.prefixes.knowledge}*`)).length,
        webSearch: (await redis.keys(`${this.prefixes.webSearch}*`)).length,
      };

      return { connected, keys };
    } catch (error) {
      logger.error('Cache stats error:', error);
      return {
        connected: false,
        keys: { session: 0, canon: 0, knowledge: 0, webSearch: 0 },
      };
    }
  }

  /**
   * Clear all cache (use with caution!)
   */
  async clearAll(): Promise<boolean> {
    try {
      await redis.flushdb();
      logger.warn('All cache cleared');
      return true;
    } catch (error) {
      logger.error('Cache clear all error:', error);
      return false;
    }
  }
}

// Singleton instance
export const cacheService = new CacheService();

