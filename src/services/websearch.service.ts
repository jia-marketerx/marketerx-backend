/**
 * Web Search Service
 * Real-time web search using Tavily API
 */

import { tavily as tavilyClient } from '../lib/tavily.js';
import { cacheService } from './cache.service.js';
import { logger } from '../utils/logger.js';

export interface WebSearchOptions {
  maxResults?: number;
  searchDepth?: 'basic' | 'advanced';
  includeDomains?: string[];
  excludeDomains?: string[];
  useCache?: boolean;
}

export interface WebSearchResult {
  query: string;
  results: Array<{
    title: string;
    url: string;
    content: string;
    score: number;
    publishedDate?: string;
  }>;
  searchTimeMs: number;
  fromCache: boolean;
  sources: number;
}

export class WebSearchService {
  /**
   * Search the web using Tavily
   * This is called OPTIONALLY by the agent when real-time data is needed
   */
  async search(
    query: string,
    options: WebSearchOptions = {}
  ): Promise<WebSearchResult> {
    const startTime = Date.now();
    const {
      maxResults = 10,
      searchDepth = 'basic',
      includeDomains = [],
      excludeDomains = [],
      useCache = true,
    } = options;

    logger.info(`Web search: "${query}" (depth: ${searchDepth})`);

    // Try cache first
    if (useCache) {
      const cached = await cacheService.getWebSearch<WebSearchResult>(query);
      if (cached) {
        logger.info('Web search results from cache');
        return {
          ...cached,
          fromCache: true,
          searchTimeMs: Date.now() - startTime,
        };
      }
    }

    try {
      // Call Tavily API
      const response = await tavilyClient.search(query, {
        max_results: maxResults,
        search_depth: searchDepth,
        include_domains: includeDomains.length > 0 ? includeDomains : undefined,
        exclude_domains: excludeDomains.length > 0 ? excludeDomains : undefined,
        include_answer: true,
        include_raw_content: false,
      });

      // Transform results
      const results = response.results.map((item: any) => ({
        title: item.title,
        url: item.url,
        content: item.content,
        score: item.score || 0,
        publishedDate: item.published_date,
      }));

      const searchTimeMs = Date.now() - startTime;

      const result: WebSearchResult = {
        query,
        results,
        searchTimeMs,
        fromCache: false,
        sources: results.length,
      };

      // Cache the result
      if (useCache) {
        await cacheService.cacheWebSearch(query, result);
      }

      logger.info(
        `Web search complete: ${results.length} results in ${searchTimeMs}ms`
      );

      return result;
    } catch (error) {
      logger.error('Web search error:', error);
      throw new Error('Failed to perform web search');
    }
  }

  /**
   * Format search results for agent consumption
   */
  formatResultsForAgent(results: WebSearchResult): string {
    if (results.results.length === 0) {
      return 'No web search results found.';
    }

    const formatted = results.results.map((result, idx) => {
      let content = `${idx + 1}. **${result.title}**\n`;
      content += `   URL: ${result.url}\n`;
      content += `   ${result.content}\n`;
      
      if (result.publishedDate) {
        content += `   Published: ${result.publishedDate}\n`;
      }

      return content;
    }).join('\n');

    return `Web search results for "${results.query}" (${results.sources} sources):\n\n${formatted}`;
  }

}

// Singleton instance
export const webSearchService = new WebSearchService();

