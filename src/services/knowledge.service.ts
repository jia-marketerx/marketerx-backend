/**
 * Knowledge Service
 * Semantic search over business resources (user-uploaded documents, guidelines)
 */

import { knowledgeRepository, type BusinessResource } from '../repositories/knowledge.js';
import { embeddingService } from './embedding.service.js';
import { cacheService } from './cache.service.js';
import { logger } from '../utils/logger.js';

export interface KnowledgeSearchOptions {
  resourceType?: 'document' | 'guideline' | 'reference' | 'example' | 'asset';
  limit?: number;
  useCache?: boolean;
}

export interface KnowledgeSearchResult {
  resources: Array<BusinessResource & { similarity: number }>;
  query: string;
  searchTimeMs: number;
  fromCache: boolean;
}

export class KnowledgeService {
  /**
   * Search business resources by semantic similarity
   * This is guided by canon - agent knows what to search for based on canon instructions
   */
  async search(
    businessProfileId: string,
    query: string,
    options: KnowledgeSearchOptions = {}
  ): Promise<KnowledgeSearchResult> {
    const startTime = Date.now();
    const { resourceType, limit = 5, useCache = true } = options;

    logger.info(`Searching knowledge base: "${query}"`);

    // Try cache first
    if (useCache) {
      const cached = await cacheService.getKnowledge<KnowledgeSearchResult>(
        businessProfileId,
        query
      );

      if (cached) {
        logger.info('Knowledge search results from cache');
        return {
          ...cached,
          fromCache: true,
          searchTimeMs: Date.now() - startTime,
        };
      }
    }

    // Generate embedding for query
    const embedding = await embeddingService.generateEmbedding(query);

    // Search by similarity
    const resources = await knowledgeRepository.searchBySimilarity(
      businessProfileId,
      embedding,
      {
        resourceType,
        limit,
      }
    );

    const searchTimeMs = Date.now() - startTime;

    const result: KnowledgeSearchResult = {
      resources,
      query,
      searchTimeMs,
      fromCache: false,
    };

    // Cache the result
    if (useCache) {
      await cacheService.cacheKnowledge(businessProfileId, query, result);
    }

    logger.info(
      `Knowledge search complete: ${resources.length} results in ${searchTimeMs}ms`
    );

    return result;
  }

  /**
   * Get specific resource by ID
   */
  async getResourceById(id: string): Promise<BusinessResource | null> {
    return knowledgeRepository.getResourceById(id);
  }

  /**
   * Get all resources for a business profile
   */
  async getAllResources(
    businessProfileId: string,
    resourceType?: string
  ): Promise<BusinessResource[]> {
    return knowledgeRepository.getResources(businessProfileId, resourceType);
  }

  /**
   * Create new resource (with automatic embedding generation)
   */
  async createResource(
    resource: Omit<BusinessResource, 'id' | 'created_at' | 'updated_at' | 'access_count' | 'is_indexed' | 'embedding'>
  ): Promise<BusinessResource> {
    // Generate embedding
    const searchableText = embeddingService.resourceToSearchableText(resource);
    const embedding = await embeddingService.generateEmbedding(searchableText);

    // Create with embedding
    const created = await knowledgeRepository.createResource({
      ...resource,
      is_active: true,
    });

    // Mark as indexed
    await knowledgeRepository.markAsIndexed(created.id, embedding);

    logger.info(`Created resource: ${created.id} (${created.title})`);

    return created;
  }

  /**
   * Update resource (regenerate embedding if content changed)
   */
  async updateResource(
    id: string,
    updates: Partial<BusinessResource>
  ): Promise<BusinessResource> {
    const updated = await knowledgeRepository.updateResource(id, updates);

    // If content changed, regenerate embedding
    if (updates.content_text || updates.title || updates.description) {
      const searchableText = embeddingService.resourceToSearchableText(updated);
      const embedding = await embeddingService.generateEmbedding(searchableText);
      await knowledgeRepository.markAsIndexed(id, embedding);
    }

    return updated;
  }

  /**
   * Delete resource
   */
  async deleteResource(id: string): Promise<boolean> {
    return knowledgeRepository.deleteResource(id);
  }

  /**
   * Index unindexed resources (background job)
   */
  async indexUnindexedResources(
    businessProfileId: string,
    batchSize: number = 10
  ): Promise<number> {
    const unindexed = await knowledgeRepository.getUnindexedResources(
      businessProfileId,
      batchSize
    );

    if (unindexed.length === 0) {
      logger.info('No unindexed resources found');
      return 0;
    }

    logger.info(`Indexing ${unindexed.length} resources...`);

    for (const resource of unindexed) {
      try {
        const searchableText = embeddingService.resourceToSearchableText(resource);
        const embedding = await embeddingService.generateEmbedding(searchableText);
        await knowledgeRepository.markAsIndexed(resource.id, embedding);
        logger.info(`Indexed resource: ${resource.id}`);
      } catch (error) {
        logger.error(`Error indexing resource ${resource.id}:`, error);
      }
    }

    return unindexed.length;
  }

  /**
   * Format search results for agent consumption
   */
  formatResultsForAgent(results: KnowledgeSearchResult): string {
    if (results.resources.length === 0) {
      return 'No relevant resources found in the knowledge base.';
    }

    const formatted = results.resources.map((resource, idx) => {
      let content = `${idx + 1}. **${resource.title}** (Relevance: ${(resource.similarity * 100).toFixed(1)}%)\n`;
      
      if (resource.description) {
        content += `   ${resource.description}\n`;
      }

      if (resource.content_text) {
        // Truncate long content
        const preview = resource.content_text.length > 300
          ? resource.content_text.substring(0, 300) + '...'
          : resource.content_text;
        content += `   ${preview}\n`;
      }

      if (resource.tags && resource.tags.length > 0) {
        content += `   Tags: ${resource.tags.join(', ')}\n`;
      }

      if (resource.file_url) {
        content += `   File: ${resource.file_url}\n`;
      }

      return content;
    }).join('\n');

    return `Found ${results.resources.length} relevant resource(s):\n\n${formatted}`;
  }
}

// Singleton instance
export const knowledgeService = new KnowledgeService();

