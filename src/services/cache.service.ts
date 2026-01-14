/**
 * Unified Cache Service
 * 
 * Provides caching functionality using Redis (Upstash)
 * Supports multiple cache layers with different TTLs
 */

import { redis } from '../lib/redis.js';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

export enum CacheLayer {
  Prompt = 'prompt',       // 5 minutes (handled by Anthropic)
  Session = 'session',     // 30 minutes
  Knowledge = 'knowledge', // 24 hours
  Canon = 'canon',         // 7 days
  Http = 'http',           // 5 minutes
}

export class CacheService {
  /**
   * Get TTL for cache layer
   */
  private static getTTL(layer: CacheLayer): number {
    switch (layer) {
      case CacheLayer.Session:
        return config.cache.ttl.session;
      case CacheLayer.Knowledge:
        return config.cache.ttl.knowledge;
      case CacheLayer.Canon:
        return config.cache.ttl.canon;
      case CacheLayer.Http:
      case CacheLayer.Prompt:
      default:
        return 300; // 5 minutes
    }
  }

  /**
   * Build cache key with namespace
   */
  private static buildKey(layer: CacheLayer, key: string): string {
    return `marketerx:${layer}:${key}`;
  }

  /**
   * Get value from cache
   */
  static async get<T>(layer: CacheLayer, key: string): Promise<T | null> {
    try {
      const cacheKey = this.buildKey(layer, key);
      const value = await redis.get(cacheKey);
      
      if (!value) {
        return null;
      }

      return JSON.parse(value) as T;
    } catch (error) {
      logger.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Set value in cache
   */
  static async set<T>(
    layer: CacheLayer,
    key: string,
    value: T,
    customTTL?: number
  ): Promise<void> {
    try {
      const cacheKey = this.buildKey(layer, key);
      const ttl = customTTL || this.getTTL(layer);
      
      await redis.setex(cacheKey, ttl, JSON.stringify(value));
    } catch (error) {
      logger.error('Cache set error:', error);
    }
  }

  /**
   * Delete value from cache
   */
  static async delete(layer: CacheLayer, key: string): Promise<void> {
    try {
      const cacheKey = this.buildKey(layer, key);
      await redis.del(cacheKey);
    } catch (error) {
      logger.error('Cache delete error:', error);
    }
  }

  /**
   * Check if key exists
   */
  static async exists(layer: CacheLayer, key: string): Promise<boolean> {
    try {
      const cacheKey = this.buildKey(layer, key);
      const result = await redis.exists(cacheKey);
      return result === 1;
    } catch (error) {
      logger.error('Cache exists error:', error);
      return false;
    }
  }

  /**
   * Clear all keys in a layer (use with caution!)
   */
  static async clearLayer(layer: CacheLayer): Promise<void> {
    try {
      const pattern = this.buildKey(layer, '*');
      const keys = await redis.keys(pattern);
      
      if (keys.length > 0) {
        await redis.del(...keys);
        logger.info(`Cleared ${keys.length} keys from ${layer} layer`);
      }
    } catch (error) {
      logger.error('Cache clear layer error:', error);
    }
  }

  /**
   * Get or set (cache-aside pattern)
   */
  static async getOrSet<T>(
    layer: CacheLayer,
    key: string,
    fetchFn: () => Promise<T>,
    customTTL?: number
  ): Promise<T> {
    // Try to get from cache
    const cached = await this.get<T>(layer, key);
    if (cached !== null) {
      return cached;
    }

    // Fetch and cache
    const value = await fetchFn();
    await this.set(layer, key, value, customTTL);
    return value;
  }
}

