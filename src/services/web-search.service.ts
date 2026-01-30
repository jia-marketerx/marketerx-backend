/**
 * Web Search Service
 * 
 * Real-time web search using Tavily API
 * Optimized for AI agents with aggregated results
 * 
 * Features:
 * - Basic search: Quick 5-source search
 * - Advanced/Deep search: Comprehensive 20-source research
 * - Content extraction: Pull raw content from specific URLs
 * - Human-in-the-loop support: Returns follow-up suggestions when results are unclear
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
  includeRawContent?: boolean; // Include full page content
  topic?: 'general' | 'news'; // Search topic focus
}

export interface WebSearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
  publishedDate?: string;
  rawContent?: string;
}

export interface WebSearchResponse {
  query: string;
  results: WebSearchResult[];
  summary?: string;
  searchDepth: 'basic' | 'advanced';
  timestamp: string;
  // Human-in-the-loop support
  followUpSuggestions?: string[];
  needsMoreContext?: boolean;
}

export interface DeepResearchOptions {
  query: string;
  context?: string; // Additional context from user
  focusAreas?: string[]; // Specific areas to research
  maxResults?: number;
}

export interface DeepResearchResponse extends WebSearchResponse {
  researchSummary: string;
  keyFindings: string[];
  suggestedFollowUps: string[];
  confidenceLevel: 'high' | 'medium' | 'low';
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
      includeRawContent = false,
      topic = 'general',
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
        includeRawContent: includeRawContent ? 'text' : undefined,
        topic,
      });

      // Analyze results to determine if follow-up might be needed
      const { followUpSuggestions, needsMoreContext } = this.analyzeResultsForFollowUp(
        query,
        response.results,
        response.answer
      );

      // Format response
      const searchResponse: WebSearchResponse = {
        query,
        results: response.results.map((r: any) => ({
          title: r.title,
          url: r.url,
          content: r.content,
          score: r.score,
          publishedDate: r.publishedDate,
          rawContent: r.rawContent,
        })),
        summary: response.answer,
        searchDepth,
        timestamp: new Date().toISOString(),
        followUpSuggestions,
        needsMoreContext,
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
   * Analyze search results to determine if human follow-up is needed
   */
  private static analyzeResultsForFollowUp(
    query: string,
    results: any[],
    summary?: string
  ): { followUpSuggestions: string[]; needsMoreContext: boolean } {
    const followUpSuggestions: string[] = [];
    let needsMoreContext = false;

    // Check if results are sparse
    if (results.length < 3) {
      needsMoreContext = true;
      followUpSuggestions.push(
        `The search for "${query}" returned limited results. Could you provide more specific details about what you're looking for?`
      );
    }

    // Check if results are too diverse (low relevance scores)
    const avgScore = results.reduce((sum, r) => sum + (r.score || 0), 0) / (results.length || 1);
    if (avgScore < 0.5 && results.length > 0) {
      needsMoreContext = true;
      followUpSuggestions.push(
        `The search results have mixed relevance. Would you like to narrow down the search to a specific aspect?`
      );
    }

    // Check for ambiguous queries
    const ambiguousTerms = ['best', 'top', 'good', 'compare', 'vs', 'versus', 'difference'];
    const hasAmbiguousTerm = ambiguousTerms.some(term => 
      query.toLowerCase().includes(term)
    );
    if (hasAmbiguousTerm && !summary) {
      followUpSuggestions.push(
        `This is a comparative query. Would you like me to focus on specific criteria for comparison?`
      );
    }

    // Suggest follow-ups for broad topics
    if (results.length > 10) {
      const uniqueDomains = new Set(results.map(r => new URL(r.url).hostname)).size;
      if (uniqueDomains > 8) {
        followUpSuggestions.push(
          `This topic has many different perspectives. Would you like to focus on a particular industry, use case, or time period?`
        );
      }
    }

    return { followUpSuggestions, needsMoreContext };
  }

  /**
   * Deep research: Comprehensive multi-query research with analysis
   * Supports human-in-the-loop through follow-up suggestions
   */
  static async deepResearch(options: DeepResearchOptions): Promise<DeepResearchResponse> {
    const { query, context, focusAreas, maxResults = 20 } = options;

    logger.info(`🔬 Starting deep research: ${query}`);

    // Build enhanced query with context
    let enhancedQuery = query;
    if (context) {
      enhancedQuery = `${query}. Context: ${context}`;
    }

    // Perform primary advanced search
    const primaryResults = await this.search({
      query: enhancedQuery,
      searchDepth: 'advanced',
      maxResults,
      includeRawContent: true,
    });

    // If focus areas are specified, perform targeted searches
    const focusResults: WebSearchResult[] = [];
    if (focusAreas && focusAreas.length > 0) {
      const focusSearches = await Promise.all(
        focusAreas.slice(0, 3).map(area => 
          this.search({
            query: `${query} ${area}`,
            searchDepth: 'basic',
            maxResults: 5,
          })
        )
      );
      focusSearches.forEach(r => focusResults.push(...r.results));
    }

    // Combine and deduplicate results
    const allResults = [...primaryResults.results, ...focusResults];
    const uniqueResults = this.deduplicateResults(allResults);

    // Extract key findings from results
    const keyFindings = this.extractKeyFindings(uniqueResults, query);

    // Generate suggested follow-ups based on gaps
    const suggestedFollowUps = this.generateDeepResearchFollowUps(
      query,
      uniqueResults,
      keyFindings
    );

    // Determine confidence level
    const confidenceLevel = this.assessConfidence(uniqueResults, primaryResults.summary);

    // Build research summary
    const researchSummary = this.buildResearchSummary(
      query,
      primaryResults.summary,
      keyFindings,
      confidenceLevel
    );

    return {
      ...primaryResults,
      results: uniqueResults.slice(0, maxResults),
      researchSummary,
      keyFindings,
      suggestedFollowUps,
      confidenceLevel,
    };
  }

  /**
   * Deduplicate results by URL
   */
  private static deduplicateResults(results: WebSearchResult[]): WebSearchResult[] {
    const seen = new Set<string>();
    return results.filter(r => {
      if (seen.has(r.url)) return false;
      seen.add(r.url);
      return true;
    });
  }

  /**
   * Extract key findings from search results
   */
  private static extractKeyFindings(results: WebSearchResult[], _query: string): string[] {
    const findings: string[] = [];
    
    // Get high-scoring results
    const topResults = results
      .filter(r => r.score > 0.6)
      .slice(0, 5);

    topResults.forEach(result => {
      // Extract first sentence or key point
      const content = result.content || '';
      const firstSentence = content.split(/[.!?]/)[0]?.trim();
      if (firstSentence && firstSentence.length > 20 && firstSentence.length < 200) {
        findings.push(firstSentence);
      }
    });

    return [...new Set(findings)].slice(0, 5);
  }

  /**
   * Generate follow-up questions for deep research
   */
  private static generateDeepResearchFollowUps(
    _query: string,
    results: WebSearchResult[],
    keyFindings: string[]
  ): string[] {
    const followUps: string[] = [];

    // Check for temporal gaps
    const hasRecentResults = results.some(r => {
      if (!r.publishedDate) return false;
      const date = new Date(r.publishedDate);
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      return date > sixMonthsAgo;
    });

    if (!hasRecentResults) {
      followUps.push(
        'Would you like me to search specifically for the most recent developments on this topic?'
      );
    }

    // Check for perspective gaps
    if (results.length < 10) {
      followUps.push(
        'Would you like me to explore alternative viewpoints or case studies on this topic?'
      );
    }

    // Suggest specificity improvements
    if (keyFindings.length < 3) {
      followUps.push(
        'The results are somewhat general. Can you specify a particular industry, region, or use case to focus on?'
      );
    }

    // Data/statistics gap
    const hasStats = results.some(r => 
      r.content && /\d+%|\$\d+|billion|million/.test(r.content)
    );
    if (!hasStats) {
      followUps.push(
        'Would you like me to search for specific statistics or data to support this research?'
      );
    }

    return followUps.slice(0, 3);
  }

  /**
   * Assess confidence in research results
   */
  private static assessConfidence(
    results: WebSearchResult[],
    summary?: string
  ): 'high' | 'medium' | 'low' {
    if (results.length === 0) return 'low';

    const avgScore = results.reduce((sum, r) => sum + (r.score || 0), 0) / results.length;
    const hasQualitySummary = summary && summary.length > 100;
    const hasManyResults = results.length >= 10;

    if (avgScore > 0.7 && hasQualitySummary && hasManyResults) return 'high';
    if (avgScore > 0.5 && (hasQualitySummary || hasManyResults)) return 'medium';
    return 'low';
  }

  /**
   * Build comprehensive research summary
   */
  private static buildResearchSummary(
    query: string,
    aiSummary?: string,
    keyFindings?: string[],
    confidenceLevel?: string
  ): string {
    const parts: string[] = [];

    parts.push(`## Research Summary: ${query}\n`);

    if (aiSummary) {
      parts.push(`### Overview\n${aiSummary}\n`);
    }

    if (keyFindings && keyFindings.length > 0) {
      parts.push(`### Key Findings`);
      keyFindings.forEach((finding, i) => {
        parts.push(`${i + 1}. ${finding}`);
      });
      parts.push('');
    }

    if (confidenceLevel) {
      const confidenceEmoji = {
        high: '🟢',
        medium: '🟡',
        low: '🔴',
      }[confidenceLevel] || '⚪';
      parts.push(`**Research Confidence:** ${confidenceEmoji} ${confidenceLevel.toUpperCase()}`);
    }

    return parts.join('\n');
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

    // Human-in-the-loop: Include follow-up suggestions if present
    if (response.needsMoreContext || (response.followUpSuggestions && response.followUpSuggestions.length > 0)) {
      sections.push('---');
      sections.push('## 🔄 Follow-up Suggestions');
      if (response.needsMoreContext) {
        sections.push('*The search results may benefit from additional context from the user.*\n');
      }
      if (response.followUpSuggestions) {
        response.followUpSuggestions.forEach((suggestion, i) => {
          sections.push(`${i + 1}. ${suggestion}`);
        });
      }
      sections.push('');
    }

    return sections.join('\n');
  }

  /**
   * Format deep research results for AI consumption
   */
  static formatDeepResearchForAI(response: DeepResearchResponse): string {
    const sections: string[] = [];

    // Research summary
    sections.push(response.researchSummary);
    sections.push('');

    // Key findings
    if (response.keyFindings && response.keyFindings.length > 0) {
      sections.push('## Key Findings');
      response.keyFindings.forEach((finding, i) => {
        sections.push(`${i + 1}. ${finding}`);
      });
      sections.push('');
    }

    // Top sources
    sections.push('## Sources');
    response.results.slice(0, 10).forEach((result, index) => {
      sections.push(`${index + 1}. [${result.title}](${result.url}) - ${(result.score * 100).toFixed(0)}% relevance`);
    });
    sections.push('');

    // Human-in-the-loop: Follow-up suggestions
    if (response.suggestedFollowUps && response.suggestedFollowUps.length > 0) {
      sections.push('---');
      sections.push('## 🔄 Suggested Follow-up Questions');
      sections.push('*Consider asking the user these questions to deepen the research:*\n');
      response.suggestedFollowUps.forEach((followUp, i) => {
        sections.push(`${i + 1}. ${followUp}`);
      });
      sections.push('');
    }

    return sections.join('\n');
  }
}

