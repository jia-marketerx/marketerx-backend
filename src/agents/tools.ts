/**
 * Tool Definitions and Handlers for Tier 1 Orchestrator
 * 
 * Implements: canon-fetch, knowledge-search, web-search
 */

import type { Tool as AnthropicTool } from '@anthropic-ai/sdk/resources/messages';
import { CanonService } from '../services/canon.service.js';
import { KnowledgeService } from '../services/knowledge.service.js';
import { WebSearchService } from '../services/web-search.service.js';
import { CanonCategory, CanonContentType } from '../types/canon.js';
import { logger } from '../utils/logger.js';
import { Tier2Executor, ContentType } from './tier2-executor.js';
import { SSEStream } from '../utils/sse.js';
import { ArtifactRepository } from '../repositories/artifacts.js';

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
 * Tool definition: content-execution
 * Generate marketing content using Tier 2 specialist agent
 */
export const contentExecutionTool: AnthropicTool = {
  name: 'content_execution',
  description:
    'Generate marketing content (email, ad, landing page, script) using specialized AI. ' +
    'Call this after attempting to gather context (canon, knowledge). ' +
    'Even if canon/knowledge return no results, still call this tool - the AI will generate quality content based on best practices. ' +
    'This tool streams the generated content to the frontend in real-time.',
  input_schema: {
    type: 'object',
    properties: {
      contentType: {
        type: 'string',
        enum: ['email', 'ad', 'landing-page', 'script'],
        description: 'Type of content to generate',
      },
      brief: {
        type: 'object',
        description:
          'Comprehensive brief with all context needed for generation. ' +
          'Should include: purpose, target audience, key message, CTA, tone, frameworks (from canon), ' +
          'brand guidelines (from knowledge), and any additional context. ' +
          'For ads: also include platform (Facebook, Instagram, Google, LinkedIn, etc.) and objective (awareness, consideration, conversion) if mentioned by user. ' +
          'For ads: include productService (product/service name) if available.',
        properties: {
          purpose: { type: 'string' },
          targetAudience: { type: 'string' },
          keyMessage: { type: 'string' },
          cta: { type: 'string' },
          tone: { type: 'string' },
          frameworks: { type: 'object' },
          brandGuidelines: { type: 'object' },
          additionalContext: { type: 'string' },
          // Ad-specific optional fields
          platform: { type: 'string', description: 'Ad platform (Facebook, Instagram, Google, LinkedIn, etc.)' },
          objective: { type: 'string', description: 'Campaign objective (awareness, consideration, conversion)' },
          productService: { type: 'string', description: 'Product or service name being advertised' },
        },
        required: ['purpose', 'targetAudience', 'keyMessage', 'cta', 'tone'],
      },
    },
    required: ['contentType', 'brief'],
  },
};

/**
 * Tool definition: validate-content
 * Validate generated content against canon rules and compliance
 */
export const validateContentTool: AnthropicTool = {
  name: 'validate_content',
  description:
    'Validate generated content against canon compliance rules, brand guidelines, and best practices. ' +
    'Call this AFTER content generation to ensure quality and compliance.',
  input_schema: {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description: 'The generated content to validate',
      },
      contentType: {
        type: 'string',
        enum: ['email', 'ad', 'landing-page', 'script'],
        description: 'Type of content being validated',
      },
      canonRules: {
        type: 'object',
        description: 'Canon compliance rules to validate against',
      },
    },
    required: ['content', 'contentType', 'canonRules'],
  },
};

/**
 * All tools available to Tier 1 agent
 */
export const allTools: AnthropicTool[] = [
  fetchCanonTool,
  knowledgeSearchTool,
  webSearchTool,
  contentExecutionTool,
  validateContentTool,
];

/**
 * Tool execution handlers
 */
export interface ToolExecutionContext {
  businessProfileId: string;
  userId: string;
  conversationId: string;
  messageId?: string;
  stream: SSEStream;
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

export async function executeContentExecution(
  input: { contentType: ContentType; brief: any },
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  try {
    logger.info(`🔧 Executing content_execution: ${input.contentType}`);

    // Initialize Tier 2 executor with stream
    const tier2 = new Tier2Executor(context.stream);

    // Generate content
    const result = await tier2.execute({
      contentType: input.contentType,
      brief: input.brief,
    });

    // Save artifact to database
    const artifactRepo = new ArtifactRepository();
    const artifact = await artifactRepo.create({
      conversationId: context.conversationId,
      messageId: context.messageId,
      userId: context.userId,
      businessProfileId: context.businessProfileId,
      contentType: input.contentType,
      title: result.title,
      content: result.content,
      metadata: {
        ...result.metadata,
        validationStatus: 'passed', // Will be updated after validation
      },
    });

    logger.info(`✅ Artifact saved: ${artifact.id}`);

    return {
      success: true,
      content: `Content generated successfully!\n\nArtifact ID: ${artifact.id}\n\n${result.content}`,
      metadata: {
        artifactId: artifact.id,
        title: result.title,
        ...result.metadata,
      },
    };
  } catch (error: any) {
    logger.error('❌ Error executing content_execution:', error);
    return {
      success: false,
      content: 'Failed to generate content',
      error: error.message,
    };
  }
}

export async function executeValidateContent(
  input: { content: string; contentType: string; canonRules: any },
  _context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  try {
    logger.info(`🔧 Executing validate_content: ${input.contentType}`);

    const issues: string[] = [];
    const warnings: string[] = [];

    // Extract compliance rules from canon
    const complianceRules = input.canonRules?.compliance_rules || [];

    // Validate against each rule
    for (const rule of complianceRules) {
      const ruleName = rule.rule || rule.name;

      // Check for specific compliance patterns
      if (input.contentType === 'email') {
        // CAN-SPAM compliance
        if (ruleName.toLowerCase().includes('unsubscribe')) {
          if (!input.content.toLowerCase().includes('unsubscribe')) {
            issues.push('Missing unsubscribe link (CAN-SPAM requirement)');
          }
        }
        if (ruleName.toLowerCase().includes('address')) {
          if (
            !input.content.includes('address') &&
            !input.content.includes('location') &&
            !input.content.includes('office')
          ) {
            warnings.push('Consider adding company physical address for CAN-SPAM compliance');
          }
        }
      }

      // Check for subject line truthfulness (email)
      if (input.contentType === 'email' && input.content.includes('<subject>')) {
        const subjectMatch = input.content.match(/<subject>(.*?)<\/subject>/i);
        if (subjectMatch) {
          const subject = subjectMatch[1];
          // Check for spam trigger words
          const spamWords = ['free', '!!!', 'urgent', 'act now', 'limited time'];
          const hasSpamWords = spamWords.some((word) =>
            subject.toLowerCase().includes(word.toLowerCase())
          );
          if (hasSpamWords) {
            warnings.push('Subject line contains potential spam trigger words');
          }
        }
      }

      // Check for CTA presence
      if (!input.content.toLowerCase().includes('cta') && input.content.length > 100) {
        warnings.push('Content may be missing a clear call-to-action');
      }
    }

    // Determine validation status
    const validationStatus = issues.length > 0 ? 'failed' : warnings.length > 0 ? 'warning' : 'passed';

    const resultMessage = [
      `Validation Status: ${validationStatus.toUpperCase()}`,
      '',
      issues.length > 0 ? '❌ Issues:' : '',
      ...issues.map((issue) => `  - ${issue}`),
      '',
      warnings.length > 0 ? '⚠️ Warnings:' : '',
      ...warnings.map((warning) => `  - ${warning}`),
      '',
      issues.length === 0 && warnings.length === 0 ? '✅ All compliance checks passed!' : '',
    ]
      .filter(Boolean)
      .join('\n');

    return {
      success: true,
      content: resultMessage,
      metadata: {
        validationStatus,
        issues,
        warnings,
        rulesChecked: complianceRules.length,
      },
    };
  } catch (error: any) {
    logger.error('❌ Error executing validate_content:', error);
    return {
      success: false,
      content: 'Failed to validate content',
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
    case 'content_execution':
      return executeContentExecution(toolInput, context);
    case 'validate_content':
      return executeValidateContent(toolInput, context);
    default:
      return {
        success: false,
        content: `Unknown tool: ${toolName}`,
        error: 'Tool not found',
      };
  }
}

