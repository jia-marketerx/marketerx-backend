/**
 * Embedding Service
 * Generates embeddings using OpenAI's text-embedding-3-large model
 */

import { openai } from '../lib/openai.js';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

export class EmbeddingService {
  private readonly model = config.models.embedding;

  /**
   * Generate embedding for a single text
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await openai.embeddings.create({
        model: this.model,
        input: text,
        encoding_format: 'float',
      });

      return response.data[0].embedding;
    } catch (error) {
      logger.error('Error generating embedding:', error);
      throw new Error('Failed to generate embedding');
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      const response = await openai.embeddings.create({
        model: this.model,
        input: texts,
        encoding_format: 'float',
      });

      return response.data.map((item) => item.embedding);
    } catch (error) {
      logger.error('Error generating embeddings:', error);
      throw new Error('Failed to generate embeddings');
    }
  }

  /**
   * Prepare text for embedding by cleaning and truncating
   * OpenAI's text-embedding-3-large supports up to 8191 tokens
   */
  prepareText(text: string, maxLength: number = 8000): string {
    // Remove excessive whitespace
    let cleaned = text.replace(/\s+/g, ' ').trim();

    // Truncate if too long (rough approximation: 4 chars ≈ 1 token)
    if (cleaned.length > maxLength * 4) {
      cleaned = cleaned.substring(0, maxLength * 4);
    }

    return cleaned;
  }

  /**
   * Create a searchable text from canon item
   */
  canonToSearchableText(canonItem: {
    title: string;
    description?: string;
    content: any;
    tags?: string[];
  }): string {
    const parts: string[] = [
      canonItem.title,
      canonItem.description || '',
    ];

    // Extract text from JSON content
    if (typeof canonItem.content === 'object') {
      parts.push(JSON.stringify(canonItem.content));
    } else if (typeof canonItem.content === 'string') {
      parts.push(canonItem.content);
    }

    // Add tags
    if (canonItem.tags && canonItem.tags.length > 0) {
      parts.push(canonItem.tags.join(' '));
    }

    return this.prepareText(parts.join(' '));
  }

  /**
   * Create a searchable text from business resource
   */
  resourceToSearchableText(resource: {
    title: string;
    description?: string;
    content_text?: string;
    tags?: string[];
  }): string {
    const parts: string[] = [
      resource.title,
      resource.description || '',
      resource.content_text || '',
    ];

    // Add tags
    if (resource.tags && resource.tags.length > 0) {
      parts.push(resource.tags.join(' '));
    }

    return this.prepareText(parts.join(' '));
  }
}

// Singleton instance
export const embeddingService = new EmbeddingService();

