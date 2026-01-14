/**
 * Web Search Service
 * 
 * Real-time web search using Tavily API
 * Optimized for AI agents with aggregated results
 */

import { tavily } from '@tavily/core';
import { CacheService, CacheLayer } from './cache.service.js';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

export interface WebSearchOptions {
  query: string;
  searchDepth?: 'basic' | 'advanced'; // basic=5 sources, advanced=20 sources
  maxResults?: number;
  includeDomains?: string[];
  excludeDomains?: string[];
}

export interface WebSearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
  publishedDate?: string;
}

export interface WebSearchResponse {
  query: string;
  results: WebSearchResult[];
  summary?: string;
  searchDepth: 'basic' | 'advanced';
  timestamp: string;
}

export class WebSearchService {
  private static client = tavily({ apiKey: config.ai.tavily.apiKey });

  /**
   * Perform web search with caching
   */
  static async search(options: WebSearchOptions): Promise<WebSearchResponse> {
    const {
      query,
      searchDepth = 'basic',
      maxResults = 10,
      includeDomains,
      excludeDomains,
    } = options;

    // Build cache key
    const cacheKey = this.buildCacheKey(query, searchDepth, includeDomains, excludeDomains);

    // Try cache first (HTTP cache layer, 5 min TTL)
    const cached = await CacheService.get<WebSearchResponse>(CacheLayer.Http, cacheKey);
    if (cached) {
      logger.info(`✅ Web search cache hit: ${query}`);
      return cached;
    }

    try {
      logger.info(`🔍 Performing web search: ${query} (depth: ${searchDepth})`);

      // Call Tavily API
      const response = await this.client.search(query, {
        searchDepth,
        maxResults,
        includeDomains,
        excludeDomains,
        includeAnswer: true, // Get AI-generated summary
        includeRawContent: false, // We don't need full HTML
      });

      // Format response
      const searchResponse: WebSearchResponse = {
        query,
        results: response.results.map((r: any) => ({
          title: r.title,
          url: r.url,
          content: r.content,
          score: r.score,
          publishedDate: r.publishedDate,
        })),
        summary: response.answer,
        searchDepth,
        timestamp: new Date().toISOString(),
      };

      // Cache result
      await CacheService.set(CacheLayer.Http, cacheKey, searchResponse, 300); // 5 min

      logger.info(`✅ Web search completed: ${response.results.length} results`);

      return searchResponse;
    } catch (error) {
      logger.error('❌ Web search error:', error);

      // Return empty response on error
      return {
        query,
        results: [],
        searchDepth,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Search for recent news/articles
   */
  static async searchNews(query: string, maxResults: number = 5): Promise<WebSearchResponse> {
    return this.search({
      query,
      searchDepth: 'basic',
      maxResults,
    });
  }

  /**
   * Deep research search (uses advanced depth)
   */
  static async deepSearch(query: string, maxResults: number = 20): Promise<WebSearchResponse> {
    return this.search({
      query,
      searchDepth: 'advanced',
      maxResults,
    });
  }

  /**
   * Build cache key from search parameters
   */
  private static buildCacheKey(
    query: string,
    searchDepth: string,
    includeDomains?: string[],
    excludeDomains?: string[]
  ): string {
    const parts = [query, searchDepth];

    if (includeDomains && includeDomains.length > 0) {
      parts.push(`include:${includeDomains.join(',')}`);
    }

    if (excludeDomains && excludeDomains.length > 0) {
      parts.push(`exclude:${excludeDomains.join(',')}`);
    }

    return parts.join('|');
  }

  /**
   * Format web search results for AI consumption
   */
  static formatForAI(response: WebSearchResponse): string {
    const sections: string[] = [];

    // Summary (if available)
    if (response.summary) {
      sections.push('## Summary');
      sections.push(response.summary);
      sections.push('');
    }

    // Results
    if (response.results.length > 0) {
      sections.push('## Search Results');
      response.results.forEach((result, index) => {
        sections.push(`### ${index + 1}. ${result.title}`);
        sections.push(`**URL:** ${result.url}`);
        sections.push(`**Relevance:** ${(result.score * 100).toFixed(1)}%`);
        if (result.publishedDate) {
          sections.push(`**Published:** ${result.publishedDate}`);
        }
        sections.push('');
        sections.push(result.content);
        sections.push('');
      });
    } else {
      sections.push('No results found.');
    }

    return sections.join('\n');
  }
}

