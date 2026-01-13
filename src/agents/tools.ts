/**
 * Tool Definitions and Execution Framework
 * Defines all tools available to Tier 1 orchestrator
 */

import { canonService } from '../services/canon.service.js';
import { knowledgeService } from '../services/knowledge.service.js';
import { webSearchService } from '../services/websearch.service.js';
import { logger } from '../utils/logger.js';

/**
 * Tool definition for Anthropic's tool use
 */
export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };
}

/**
 * Tool execution result
 */
export interface ToolResult {
  toolName: string;
  success: boolean;
  data?: any;
  error?: string;
  executionTimeMs: number;
}

/**
 * All tool definitions for Tier 1 agent
 */
export const toolDefinitions: ToolDefinition[] = [
  {
    name: 'fetch-canon',
    description: 'Load proprietary frameworks, templates, and compliance rules. Call this EARLY after understanding user intent to guide subsequent searches.',
    input_schema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: ['template', 'framework', 'compliance', 'style', 'all'],
          description: 'Category of canon to load'
        },
        contentType: {
          type: 'string',
          enum: ['email', 'ad', 'landing-page', 'script'],
          description: 'Type of content being created'
        }
      },
      required: ['category', 'contentType']
    }
  },
  
  {
    name: 'knowledge-search',
    description: 'Search user\'s business resources using semantic search. Use canon guidance to know what to search for.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Semantic search query based on user need and canon guidance'
        },
        topK: {
          type: 'number',
          description: 'Number of results to return',
          default: 5
        },
        resourceType: {
          type: 'string',
          enum: ['document', 'guideline', 'reference', 'example', 'asset'],
          description: 'Optional: filter by resource type'
        }
      },
      required: ['query']
    }
  },
  
  {
    name: 'knowledge-fetch',
    description: 'Retrieve full content of a specific resource by ID',
    input_schema: {
      type: 'object',
      properties: {
        resourceId: {
          type: 'string',
          description: 'UUID of the resource to fetch'
        }
      },
      required: ['resourceId']
    }
  },
  
  {
    name: 'web-search',
    description: 'Search the web for real-time information. Only use when current data is needed and knowledge base is insufficient.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query'
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of results',
          default: 10
        },
        searchDepth: {
          type: 'string',
          enum: ['basic', 'advanced'],
          description: 'basic=5 sources, advanced=20 sources',
          default: 'basic'
        }
      },
      required: ['query']
    }
  },
  
  {
    name: 'content-execution',
    description: 'Generate content using specialized writing agent (Tier 2). Provide a comprehensive brief with all context.',
    input_schema: {
      type: 'object',
      properties: {
        contentType: {
          type: 'string',
          enum: ['email', 'ad', 'landing-page', 'script'],
          description: 'Type of content to generate'
        },
        objective: {
          type: 'string',
          description: 'Clear objective for the content'
        },
        targetAudience: {
          type: 'string',
          description: 'Target audience description'
        },
        brandGuidelines: {
          type: 'string',
          description: 'Brand voice and style guidelines from canon'
        },
        templates: {
          type: 'array',
          items: { type: 'object' },
          description: 'Template structures from canon'
        },
        complianceRules: {
          type: 'array',
          items: { type: 'object' },
          description: 'Compliance requirements from canon'
        },
        research: {
          type: 'string',
          description: 'Summary of knowledge and web research findings'
        },
        tone: {
          type: 'string',
          description: 'Desired tone (e.g., professional, friendly, urgent)'
        }
      },
      required: ['contentType', 'objective', 'targetAudience']
    }
  }
];

/**
 * Tool Executor
 * Executes tools and returns results
 */
export class ToolExecutor {
  /**
   * Execute a tool call
   */
  async execute(
    toolName: string,
    input: any,
    context: {
      businessProfileId: string;
      conversationId?: string;
    }
  ): Promise<ToolResult> {
    const startTime = Date.now();
    
    try {
      logger.info(`Executing tool: ${toolName}`, { input });

      let data: any;

      switch (toolName) {
        case 'fetch-canon':
          data = await this.executeFetchCanon(input, context);
          break;

        case 'knowledge-search':
          data = await this.executeKnowledgeSearch(input, context);
          break;

        case 'knowledge-fetch':
          data = await this.executeKnowledgeFetch(input, context);
          break;

        case 'web-search':
          data = await this.executeWebSearch(input, context);
          break;

        case 'content-execution':
          data = await this.executeContentExecution(input, context);
          break;

        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }

      const executionTimeMs = Date.now() - startTime;

      logger.info(`Tool ${toolName} completed in ${executionTimeMs}ms`);

      return {
        toolName,
        success: true,
        data,
        executionTimeMs,
      };
    } catch (error: any) {
      const executionTimeMs = Date.now() - startTime;
      logger.error(`Tool ${toolName} failed:`, error);

      return {
        toolName,
        success: false,
        error: error.message || 'Unknown error',
        executionTimeMs,
      };
    }
  }

  /**
   * Execute fetch-canon tool
   */
  private async executeFetchCanon(
    input: { category: string; contentType: string },
    context: { businessProfileId: string; conversationId?: string }
  ): Promise<any> {
    const result = await canonService.fetchCanon(context.businessProfileId, {
      category: input.category as any,
      contentType: input.contentType as any,
      useCache: true,
    });

    // Log usage for each canon item
    for (const item of result.items) {
      await canonService.logUsage(
        item.id,
        context.businessProfileId,
        context.conversationId || null,
        {
          contentType: input.contentType,
          wasCached: result.fromCache,
          loadTimeMs: result.loadTimeMs,
        }
      );
    }

    // Format for agent consumption
    return {
      summary: result.summary,
      items: result.items.map((item) => ({
        id: item.id,
        title: item.title,
        slug: item.slug,
        description: item.description,
        content: item.content,
        tags: item.tags,
      })),
      formatted: canonService.formatForAgent(result.items),
      loadTimeMs: result.loadTimeMs,
      fromCache: result.fromCache,
    };
  }

  /**
   * Execute knowledge-search tool
   */
  private async executeKnowledgeSearch(
    input: { query: string; topK?: number; resourceType?: string },
    context: { businessProfileId: string }
  ): Promise<any> {
    const result = await knowledgeService.search(
      context.businessProfileId,
      input.query,
      {
        limit: input.topK || 5,
        resourceType: input.resourceType as any,
        useCache: true,
      }
    );

    return {
      query: result.query,
      results: result.resources.map((resource) => ({
        id: resource.id,
        title: resource.title,
        description: resource.description,
        contentPreview: resource.content_text?.substring(0, 500),
        fileUrl: resource.file_url,
        tags: resource.tags,
        similarity: resource.similarity,
      })),
      formatted: knowledgeService.formatResultsForAgent(result),
      searchTimeMs: result.searchTimeMs,
      fromCache: result.fromCache,
    };
  }

  /**
   * Execute knowledge-fetch tool
   */
  private async executeKnowledgeFetch(
    input: { resourceId: string },
    context: { businessProfileId: string }
  ): Promise<any> {
    const resource = await knowledgeService.getResourceById(input.resourceId);

    if (!resource) {
      throw new Error(`Resource not found: ${input.resourceId}`);
    }

    return {
      id: resource.id,
      title: resource.title,
      description: resource.description,
      content: resource.content_text,
      fileUrl: resource.file_url,
      tags: resource.tags,
      resourceType: resource.resource_type,
    };
  }

  /**
   * Execute web-search tool
   */
  private async executeWebSearch(
    input: { query: string; maxResults?: number; searchDepth?: string },
    context: { businessProfileId: string }
  ): Promise<any> {
    const result = await webSearchService.search(input.query, {
      maxResults: input.maxResults || 10,
      searchDepth: (input.searchDepth as 'basic' | 'advanced') || 'basic',
      useCache: true,
    });

    return {
      query: result.query,
      results: result.results,
      formatted: webSearchService.formatResultsForAgent(result),
      sources: result.sources,
      searchTimeMs: result.searchTimeMs,
      fromCache: result.fromCache,
    };
  }

  /**
   * Execute content-execution tool (Tier 2)
   */
  private async executeContentExecution(
    input: any,
    context: { businessProfileId: string; conversationId?: string }
  ): Promise<any> {
    // TODO: Implement Tier 2 content execution in Phase 6
    // For now, return a placeholder
    return {
      contentType: input.contentType,
      status: 'pending',
      message: 'Tier 2 content execution will be implemented in Phase 6',
      brief: input,
    };
  }
}

// Singleton instance
export const toolExecutor = new ToolExecutor();

