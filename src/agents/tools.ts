/**
 * Tool Definitions and Handlers for Tier 1 Orchestrator
 * 
 * Implements: canon-fetch, knowledge-search, web-search
 */

import type { Tool as AnthropicTool } from '@anthropic-ai/sdk/resources/messages.mjs';
import { CanonService } from '../services/canon.service.js';
import { KnowledgeService } from '../services/knowledge.service.js';
import { WebSearchService } from '../services/web-search.service.js';
import { CanonCategory, CanonContentType } from '../types/canon.js';
import { logger } from '../utils/logger.js';

/**
 * Tool definition: fetch-canon
 * Load proprietary frameworks, templates, and compliance rules
 */
export const fetchCanonTool: AnthropicTool = {
  name: 'fetch_canon',
  description:
    'Load proprietary frameworks, templates, and compliance rules for content generation. ' +
    'This should be called EARLY after understanding user intent to guide all subsequent tool usage.',
  input_schema: {
    type: 'object',
    properties: {
      category: {
        type: 'string',
        enum: ['template', 'framework', 'compliance', 'all'],
        description: 'Category of canon to fetch',
      },
      contentType: {
        type: 'string',
        enum: ['email', 'ad', 'landing-page', 'script', 'general'],
        description: 'Content type to fetch canon for',
      },
    },
    required: ['category', 'contentType'],
  },
};

/**
 * Tool definition: knowledge-search
 * Search user's business resources using semantic similarity
 */
export const knowledgeSearchTool: AnthropicTool = {
  name: 'knowledge_search',
  description:
    'Search user business resources (brand guidelines, offers, testimonials, case studies, copywriting handbooks) ' +
    'using semantic similarity. Use this AFTER loading canon to find specific brand/product information.',
  input_schema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query for finding relevant business resources',
      },
      topK: {
        type: 'number',
        description: 'Number of results to return (default: 5)',
        default: 5,
      },
      resourceTypes: {
        type: 'array',
        items: { type: 'string' },
        description: 'Filter by resource types: brand_guidelines, offer, testimonial, case_study, handbook',
      },
    },
    required: ['query'],
  },
};

/**
 * Tool definition: web-search
 * Search the web for real-time information
 */
export const webSearchTool: AnthropicTool = {
  name: 'web_search',
  description:
    'Search the web for real-time information, trends, competitor research, or industry insights. ' +
    'Use this when user asks for current data OR canon/knowledge suggest external research.',
  input_schema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Web search query',
      },
      searchDepth: {
        type: 'string',
        enum: ['basic', 'advanced'],
        description: 'basic = 5 sources (fast), advanced = 20 sources (comprehensive)',
        default: 'basic',
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of results to return (default: 10)',
        default: 10,
      },
    },
    required: ['query'],
  },
};

/**
 * All tools available to Tier 1 agent
 */
export const allTools: AnthropicTool[] = [fetchCanonTool, knowledgeSearchTool, webSearchTool];

/**
 * Tool execution handlers
 */
export interface ToolExecutionContext {
  businessProfileId: string;
  userId: string;
}

export interface ToolExecutionResult {
  success: boolean;
  content: string;
  metadata?: Record<string, any>;
  error?: string;
}

export async function executeFetchCanon(
  input: { category: string; contentType: string },
  _context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  try {
    logger.info(`🔧 Executing fetch_canon: ${input.category} / ${input.contentType}`);

    const canons = await CanonService.fetchCanons({
      category: input.category === 'all' ? undefined : (input.category as CanonCategory),
      contentType: input.contentType as CanonContentType,
    });

    const formatted = CanonService.formatForAI(canons);

    return {
      success: true,
      content: formatted,
      metadata: {
        count: canons.length,
        category: input.category,
        contentType: input.contentType,
      },
    };
  } catch (error: any) {
    logger.error('❌ Error executing fetch_canon:', error);
    return {
      success: false,
      content: 'Failed to fetch canon data',
      error: error.message,
    };
  }
}

export async function executeKnowledgeSearch(
  input: { query: string; topK?: number; resourceTypes?: string[] },
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  try {
    logger.info(`🔧 Executing knowledge_search: ${input.query}`);

    const results = await KnowledgeService.search({
      query: input.query,
      businessProfileId: context.businessProfileId,
      topK: input.topK || 5,
      resourceTypes: input.resourceTypes,
    });

    const formatted = KnowledgeService.formatForAI(results);

    return {
      success: true,
      content: formatted,
      metadata: {
        resultCount: results.length,
        query: input.query,
      },
    };
  } catch (error: any) {
    logger.error('❌ Error executing knowledge_search:', error);
    return {
      success: false,
      content: 'Failed to search knowledge base',
      error: error.message,
    };
  }
}

export async function executeWebSearch(
  input: { query: string; searchDepth?: 'basic' | 'advanced'; maxResults?: number },
  _context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  try {
    logger.info(`🔧 Executing web_search: ${input.query} (${input.searchDepth || 'basic'})`);

    const response = await WebSearchService.search({
      query: input.query,
      searchDepth: input.searchDepth || 'basic',
      maxResults: input.maxResults || 10,
    });

    const formatted = WebSearchService.formatForAI(response);

    return {
      success: true,
      content: formatted,
      metadata: {
        resultCount: response.results.length,
        summary: response.summary,
        query: input.query,
      },
    };
  } catch (error: any) {
    logger.error('❌ Error executing web_search:', error);
    return {
      success: false,
      content: 'Failed to perform web search',
      error: error.message,
    };
  }
}

/**
 * Execute tool by name
 */
export async function executeTool(
  toolName: string,
  toolInput: any,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  switch (toolName) {
    case 'fetch_canon':
      return executeFetchCanon(toolInput, context);
    case 'knowledge_search':
      return executeKnowledgeSearch(toolInput, context);
    case 'web_search':
      return executeWebSearch(toolInput, context);
    default:
      return {
        success: false,
        content: `Unknown tool: ${toolName}`,
        error: 'Tool not found',
      };
  }
}

