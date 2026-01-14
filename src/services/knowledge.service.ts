/**
 * Knowledge Search Service
 * 
 * Semantic search across user's business resources using vector embeddings
 * Searches: brand guidelines, offers, testimonials, case studies, handbooks, avatars
 */

import { supabase } from '../lib/supabase.js';
import { openai } from '../lib/openai.js';
import { CacheService, CacheLayer } from './cache.service.js';
import { logger } from '../utils/logger.js';

export interface KnowledgeSearchOptions {
  query: string;
  businessProfileId: string;
  topK?: number;
  resourceTypes?: string[];
  threshold?: number; // Minimum similarity score (0-1)
}

export interface KnowledgeSearchResult {
  id: string;
  title: string;
  content: string;
  resourceType: string;
  similarity: number;
  metadata: Record<string, any>;
}

export class KnowledgeService {
  /**
   * Search business resources using semantic similarity
   */
  static async search(options: KnowledgeSearchOptions): Promise<KnowledgeSearchResult[]> {
    const { query, businessProfileId, topK = 5, resourceTypes, threshold = 0.7 } = options;

    try {
      // Generate query embedding
      const embedding = await this.generateEmbedding(query);

      // Search across multiple resource tables
      const results = await Promise.all([
        this.searchBrandGuidelines(businessProfileId, embedding, topK, threshold),
        this.searchOffers(businessProfileId, embedding, topK, threshold),
        this.searchTestimonials(businessProfileId, embedding, topK, threshold),
        this.searchCaseStudies(businessProfileId, embedding, topK, threshold),
        this.searchHandbooks(businessProfileId, embedding, topK, threshold),
      ]);

      // Flatten and filter by resource types if specified
      let allResults = results.flat();

      if (resourceTypes && resourceTypes.length > 0) {
        allResults = allResults.filter((r) => resourceTypes.includes(r.resourceType));
      }

      // Sort by similarity and return top K
      return allResults
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, topK);
    } catch (error) {
      logger.error('❌ Knowledge search error:', error);
      return [];
    }
  }

  /**
   * Generate embedding for query (with caching)
   */
  private static async generateEmbedding(text: string): Promise<number[]> {
    const cacheKey = `embedding:${text}`;

    return CacheService.getOrSet(
      CacheLayer.Knowledge,
      cacheKey,
      async () => {
        const response = await openai.embeddings.create({
          model: 'text-embedding-3-large',
          input: text,
          encoding_format: 'float',
        });

        return response.data[0].embedding;
      }
    );
  }

  /**
   * Search brand guidelines
   */
  private static async searchBrandGuidelines(
    businessProfileId: string,
    embedding: number[],
    topK: number,
    threshold: number
  ): Promise<KnowledgeSearchResult[]> {
    const { data, error } = await supabase.rpc('match_brand_guidelines', {
      query_embedding: embedding,
      match_threshold: threshold,
      match_count: topK,
      filter_business_profile_id: businessProfileId,
    });

    if (error || !data) return [];

    return data.map((row: any) => ({
      id: row.id,
      title: 'Brand Guidelines',
      content: row.search_content || '',
      resourceType: 'brand_guidelines',
      similarity: row.similarity,
      metadata: {
        personality: row.personality,
        tone: row.tone,
        values: row.values,
      },
    }));
  }

  /**
   * Search offers
   */
  private static async searchOffers(
    businessProfileId: string,
    embedding: number[],
    topK: number,
    threshold: number
  ): Promise<KnowledgeSearchResult[]> {
    const { data, error } = await supabase.rpc('match_offers', {
      query_embedding: embedding,
      match_threshold: threshold,
      match_count: topK,
      filter_business_profile_id: businessProfileId,
    });

    if (error || !data) return [];

    return data.map((row: any) => ({
      id: row.id,
      title: row.name,
      content: row.search_content || '',
      resourceType: 'offer',
      similarity: row.similarity,
      metadata: {
        price: row.price,
        description: row.description,
      },
    }));
  }

  /**
   * Search testimonials
   */
  private static async searchTestimonials(
    businessProfileId: string,
    embedding: number[],
    topK: number,
    threshold: number
  ): Promise<KnowledgeSearchResult[]> {
    const { data, error } = await supabase.rpc('match_testimonials', {
      query_embedding: embedding,
      match_threshold: threshold,
      match_count: topK,
      filter_business_profile_id: businessProfileId,
    });

    if (error || !data) return [];

    return data.map((row: any) => ({
      id: row.id,
      title: `Testimonial from ${row.customer_name || 'Anonymous'}`,
      content: row.quote,
      resourceType: 'testimonial',
      similarity: row.similarity,
      metadata: {
        customerName: row.customer_name,
        rating: row.rating,
      },
    }));
  }

  /**
   * Search case studies
   */
  private static async searchCaseStudies(
    businessProfileId: string,
    embedding: number[],
    topK: number,
    threshold: number
  ): Promise<KnowledgeSearchResult[]> {
    const { data, error } = await supabase.rpc('match_case_studies', {
      query_embedding: embedding,
      match_threshold: threshold,
      match_count: topK,
      filter_business_profile_id: businessProfileId,
    });

    if (error || !data) return [];

    return data.map((row: any) => ({
      id: row.id,
      title: row.title,
      content: row.search_content || '',
      resourceType: 'case_study',
      similarity: row.similarity,
      metadata: {
        clientName: row.client_name,
        industry: row.industry,
      },
    }));
  }

  /**
   * Search copywriting handbooks
   */
  private static async searchHandbooks(
    businessProfileId: string,
    embedding: number[],
    topK: number,
    threshold: number
  ): Promise<KnowledgeSearchResult[]> {
    const { data, error } = await supabase.rpc('match_handbooks', {
      query_embedding: embedding,
      match_threshold: threshold,
      match_count: topK,
      filter_business_profile_id: businessProfileId,
    });

    if (error || !data) return [];

    return data.map((row: any) => ({
      id: row.id,
      title: row.custom_name || row.title || 'Copywriting Handbook',
      content: row.search_content || '',
      resourceType: 'handbook',
      similarity: row.similarity,
      metadata: {},
    }));
  }

  /**
   * Format knowledge results for AI consumption
   */
  static formatForAI(results: KnowledgeSearchResult[]): string {
    if (results.length === 0) {
      return 'No relevant knowledge found in business resources.';
    }

    const formatted = results.map((result, index) => {
      return [
        `### Result ${index + 1}: ${result.title} (${(result.similarity * 100).toFixed(1)}% match)`,
        `**Type:** ${result.resourceType}`,
        '',
        result.content.substring(0, 500) + (result.content.length > 500 ? '...' : ''),
      ].join('\n');
    });

    return formatted.join('\n\n---\n\n');
  }
}

