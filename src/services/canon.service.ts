/**
 * Canon Service
 * Business logic for loading and managing canon (frameworks, templates, compliance rules)
 */

import { canonRepository, type CanonItem } from '../repositories/canon.js';
import { embeddingService } from './embedding.service.js';
import { cacheService } from './cache.service.js';
import { logger } from '../utils/logger.js';

export interface FetchCanonOptions {
  category?: 'template' | 'framework' | 'compliance' | 'style' | 'all';
  contentType: 'email' | 'ad' | 'landing-page' | 'script';
  useCache?: boolean;
}

export interface CanonLoadResult {
  items: CanonItem[];
  loadTimeMs: number;
  fromCache: boolean;
  summary: string;
}

export class CanonService {
  /**
   * Fetch canon items for a specific content type
   * This is called EARLY in the agent flow (right after intent analysis)
   */
  async fetchCanon(
    businessProfileId: string,
    options: FetchCanonOptions
  ): Promise<CanonLoadResult> {
    const startTime = Date.now();
    const { category, contentType, useCache = true } = options;

    logger.info(`Fetching canon for ${contentType}, category: ${category || 'all'}`);

    // Try cache first
    if (useCache) {
      const cacheKey = `${contentType}:${category || 'all'}`;
      const cached = await cacheService.getCanon<CanonLoadResult>(
        businessProfileId,
        cacheKey
      );

      if (cached) {
        logger.info('Canon loaded from cache');
        return {
          ...cached,
          fromCache: true,
          loadTimeMs: Date.now() - startTime,
        };
      }
    }

    // Get category ID if specified
    let categoryId: string | undefined;
    if (category && category !== 'all') {
      const categoryData = await canonRepository.getCategoryByName(category);
      categoryId = categoryData?.id;
    }

    // Fetch from database
    const items = await canonRepository.getCanonItems(
      businessProfileId,
      contentType,
      categoryId
    );

    const loadTimeMs = Date.now() - startTime;

    // Generate summary
    const summary = this.generateCanonSummary(items, contentType);

    const result: CanonLoadResult = {
      items,
      loadTimeMs,
      fromCache: false,
      summary,
    };

    // Cache the result
    if (useCache) {
      const cacheKey = `${contentType}:${category || 'all'}`;
      await cacheService.cacheCanon(businessProfileId, cacheKey, result);
    }

    logger.info(`Canon loaded: ${items.length} items in ${loadTimeMs}ms`);

    return result;
  }

  /**
   * Generate a human-readable summary of loaded canon
   * This is what the agent sees to understand what guidance is available
   */
  private generateCanonSummary(items: CanonItem[], contentType: string): string {
    if (items.length === 0) {
      return `No canon items found for ${contentType}. Proceeding with general best practices.`;
    }

    const byCategory: Record<string, CanonItem[]> = {};
    items.forEach((item) => {
      const catName = item.category_id; // We'll need to expand this with actual category names
      if (!byCategory[catName]) byCategory[catName] = [];
      byCategory[catName].push(item);
    });

    const summaryParts: string[] = [
      `Loaded ${items.length} canon item(s) for ${contentType}:`,
    ];

    items.forEach((item) => {
      summaryParts.push(
        `- ${item.title} (${item.slug}): ${item.description || 'No description'}`
      );
    });

    summaryParts.push(
      '\nUse these canon items to guide your knowledge search and content generation.'
    );

    return summaryParts.join('\n');
  }

  /**
   * Search canon by semantic similarity
   * Useful when agent wants to find relevant canon based on user intent
   */
  async searchCanon(
    businessProfileId: string,
    query: string,
    options: {
      contentType?: string;
      category?: string;
      limit?: number;
    } = {}
  ): Promise<Array<CanonItem & { similarity: number }>> {
    // Generate embedding for query
    const embedding = await embeddingService.generateEmbedding(query);

    // Get category ID if specified
    let categoryId: string | undefined;
    if (options.category) {
      const categoryData = await canonRepository.getCategoryByName(options.category);
      categoryId = categoryData?.id;
    }

    // Search by similarity
    const results = await canonRepository.searchBySimilarity(
      businessProfileId,
      embedding,
      {
        contentType: options.contentType,
        categoryId,
        limit: options.limit || 5,
      }
    );

    return results;
  }

  /**
   * Get specific canon by slug
   */
  async getCanonBySlug(
    businessProfileId: string,
    slug: string
  ): Promise<CanonItem | null> {
    return canonRepository.getCanonBySlug(businessProfileId, slug);
  }

  /**
   * Create new canon item (with automatic embedding generation)
   */
  async createCanonItem(
    item: Omit<CanonItem, 'id' | 'created_at' | 'updated_at' | 'embedding' | 'usage_count' | 'version'>
  ): Promise<CanonItem> {
    // Generate embedding
    const searchableText = embeddingService.canonToSearchableText(item);
    const embedding = await embeddingService.generateEmbedding(searchableText);

    // Create with embedding
    const created = await canonRepository.createCanonItem({
      ...item,
      embedding,
      usage_count: 0,
      version: 1,
    });

    // Invalidate cache
    await cacheService.invalidateCanon(item.business_profile_id);

    logger.info(`Created canon item: ${created.id} (${created.slug})`);

    return created;
  }

  /**
   * Update canon item (regenerate embedding if content changed)
   */
  async updateCanonItem(
    id: string,
    updates: Partial<CanonItem>
  ): Promise<CanonItem> {
    // If content changed, regenerate embedding
    if (updates.content || updates.title || updates.description) {
      const existing = await canonRepository.getCanonItems('', '', ''); // We need to fetch existing first
      // For now, let's regenerate embedding for any update
      const embedding = await embeddingService.generateEmbedding(
        JSON.stringify(updates)
      );
      updates.embedding = embedding;
    }

    const updated = await canonRepository.updateCanonItem(id, updates);

    // Invalidate cache
    await cacheService.invalidateCanon(updated.business_profile_id);

    return updated;
  }

  /**
   * Log canon usage (for analytics)
   */
  async logUsage(
    canonItemId: string,
    businessProfileId: string,
    conversationId: string | null,
    context: {
      contentType: string;
      userQuery?: string;
      wasCached?: boolean;
      loadTimeMs?: number;
    }
  ): Promise<void> {
    await canonRepository.logUsage(
      canonItemId,
      businessProfileId,
      conversationId,
      context
    );
  }

  /**
   * Format canon items for agent consumption
   * Converts JSONB content into readable instructions
   */
  formatForAgent(items: CanonItem[]): string {
    if (items.length === 0) {
      return 'No canon guidelines available.';
    }

    const formatted = items.map((item) => {
      let content = `### ${item.title}\n`;
      
      if (item.description) {
        content += `${item.description}\n\n`;
      }

      // Format content based on structure
      if (typeof item.content === 'object') {
        content += this.formatContentObject(item.content);
      } else {
        content += `${item.content}\n`;
      }

      if (item.tags && item.tags.length > 0) {
        content += `\nTags: ${item.tags.join(', ')}`;
      }

      return content;
    }).join('\n\n---\n\n');

    return formatted;
  }

  /**
   * Format JSONB content object into readable text
   */
  private formatContentObject(content: any): string {
    const lines: string[] = [];

    if (content.structure) {
      lines.push('**Structure:**');
      if (Array.isArray(content.structure)) {
        content.structure.forEach((section: any) => {
          lines.push(`- ${section.section}: ${section.guidelines || section.description || ''}`);
        });
      }
      lines.push('');
    }

    if (content.steps) {
      lines.push('**Steps:**');
      if (Array.isArray(content.steps)) {
        content.steps.forEach((step: any, idx: number) => {
          lines.push(`${idx + 1}. ${step.step || step.name}: ${step.purpose || step.description || ''}`);
          if (step.tactics && Array.isArray(step.tactics)) {
            step.tactics.forEach((tactic: string) => {
              lines.push(`   - ${tactic}`);
            });
          }
        });
      }
      lines.push('');
    }

    if (content.requirements) {
      lines.push('**Requirements:**');
      lines.push(JSON.stringify(content.requirements, null, 2));
      lines.push('');
    }

    if (content.example) {
      lines.push('**Example:**');
      lines.push(content.example);
      lines.push('');
    }

    if (content.bestFor) {
      lines.push(`**Best For:** ${Array.isArray(content.bestFor) ? content.bestFor.join(', ') : content.bestFor}`);
    }

    return lines.join('\n');
  }
}

// Singleton instance
export const canonService = new CanonService();

