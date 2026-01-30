/**
 * Knowledge Search Service
 * 
 * Semantic search across user's business resources using vector embeddings
 * Searches: brand guidelines, offers (with enhanced offers), testimonials, case studies, 
 * handbooks, avatars, research oracle reports, and uploaded business resources/documents
 */

import { supabase } from '../lib/supabase.js';
import { logger } from '../utils/logger.js';
import { generateEmbedding } from '../lib/openai.js';

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

// All supported resource types
export const SUPPORTED_RESOURCE_TYPES = [
  'brand_guidelines',
  'offer',
  'testimonial',
  'case_study',
  'handbook',
  'avatar',
  'research_report',
  'business_resource',
] as const;

export type ResourceType = typeof SUPPORTED_RESOURCE_TYPES[number];

export class KnowledgeService {
  /**
   * Search business resources using semantic similarity
   */
  static async search(options: KnowledgeSearchOptions): Promise<KnowledgeSearchResult[]> {
    // Lower default threshold from 0.7 to 0.5 for better match rate
    // 0.5 is still a good similarity score but allows more relevant results
    const { 
      businessProfileId, 
      query, 
      topK = 5, 
      resourceTypes,
      threshold = 0.0
    } = options;
    logger.info(`🔍 Options: ${JSON.stringify(options, null, 2)}`);

    try {
      // Generate query embedding
      const embedding = await generateEmbedding(query);

      logger.info(`🔍 Embedding generated for query: ${query}`);
      logger.info(`🔍 Embedding: ${embedding}`);

      // Search across ALL resource tables (including avatars, research reports, business resources)
      const results = await Promise.all([
        this.searchBrandGuidelines(businessProfileId, embedding, topK, threshold),
        this.searchOffers(businessProfileId, embedding, topK, threshold),
        this.searchTestimonials(businessProfileId, embedding, topK, threshold),
        this.searchCaseStudies(businessProfileId, embedding, topK, threshold),
        this.searchHandbooks(businessProfileId, embedding, topK, threshold),
        this.searchAvatars(businessProfileId, embedding, topK, threshold),
        this.searchResearchReports(businessProfileId, embedding, topK, threshold),
        this.searchBusinessResources(businessProfileId, embedding, topK, threshold),
      ]);
      logger.info(`🔍 Search completed across ${results.length} resource types`);
      logger.info(`🔍 Results per type: ${results.map((r, i) => `[${i}]:${r.length}`).join(', ')}`);

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
   * Search offers (includes enhanced offer data when available)
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

    return data.map((row: any) => {
      // Build enhanced content if available
      const contentParts = [row.search_content || ''];
      
      if (row.offer_summary) {
        contentParts.push(`\n**Offer Summary:** ${row.offer_summary}`);
      }
      if (row.dream_outcome) {
        contentParts.push(`\n**Dream Outcome:** ${row.dream_outcome}`);
      }
      if (row.believability_mechanism) {
        contentParts.push(`\n**Believability Mechanism:** ${row.believability_mechanism}`);
      }
      if (row.risk_reversal) {
        contentParts.push(`\n**Risk Reversal:** ${row.risk_reversal}`);
      }

      return {
        id: row.id,
        title: row.name,
        content: contentParts.join(''),
        resourceType: 'offer',
        similarity: row.similarity,
        metadata: {
          price: row.price,
          description: row.description,
          // Enhanced offer metadata
          hasEnhancedOffer: !!row.offer_summary,
          dreamOutcome: row.dream_outcome,
          timeToResult: row.time_to_result,
          effortAvoided: row.effort_avoided,
          believabilityMechanism: row.believability_mechanism,
          coreOffer: row.core_offer,
          bonuses: row.bonuses,
          riskReversal: row.risk_reversal,
          scarcityUrgency: row.scarcity_urgency,
          offerSummary: row.offer_summary,
          objectionsRebuttals: row.objections_rebuttals,
        },
      };
    });
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
   * Search customer avatars
   * Extracts: persona, demographics, pain points, goals, psychographics, 
   * purchase motivations, communication preferences, behavioral data
   */
  private static async searchAvatars(
    businessProfileId: string,
    embedding: number[],
    topK: number,
    threshold: number
  ): Promise<KnowledgeSearchResult[]> {
    const { data, error } = await supabase.rpc('match_avatars', {
      query_embedding: embedding,
      match_threshold: threshold,
      match_count: topK,
      filter_business_profile_id: businessProfileId,
    });

    if (error || !data) {
      logger.debug('No avatars found or error:', error);
      return [];
    }

    return data.map((row: any) => {
      // Get the avatar data from whichever version is available
      const avatar = row.selected_avatar || row.version_gpt4o || row.version_claude || {};
      const contentParts: string[] = [];

      // Persona & Basic Info
      const nickname = avatar.nickname || row.name || 'Customer Avatar';
      contentParts.push(`**Avatar:** ${nickname}`);
      
      if (avatar.persona?.bio) {
        contentParts.push(`\n**Bio:** ${avatar.persona.bio}`);
      }
      if (avatar.persona?.dayInLife) {
        contentParts.push(`\n**Day in Life:** ${avatar.persona.dayInLife}`);
      }
      if (avatar.persona?.quote) {
        contentParts.push(`\n**Quote:** "${avatar.persona.quote}"`);
      }

      // Demographics
      if (avatar.demographics) {
        const demo = avatar.demographics;
        const demoItems = [];
        if (demo.ageRange) demoItems.push(`Age: ${demo.ageRange}`);
        if (demo.gender) demoItems.push(`Gender: ${demo.gender}`);
        if (demo.income) demoItems.push(`Income: ${demo.income}`);
        if (demo.location) demoItems.push(`Location: ${demo.location}`);
        if (demo.education) demoItems.push(`Education: ${demo.education}`);
        if (demo.occupation) demoItems.push(`Occupation: ${demo.occupation}`);
        if (demoItems.length > 0) {
          contentParts.push(`\n**Demographics:** ${demoItems.join(' | ')}`);
        }
      }

      // Pain Points (from behavioral or direct)
      if (avatar.behavioral?.coreFear) {
        contentParts.push(`\n**Core Fear:** ${avatar.behavioral.coreFear.primary || avatar.behavioral.coreFear}`);
        if (avatar.behavioral.coreFear.description) {
          contentParts.push(` - ${avatar.behavioral.coreFear.description}`);
        }
      }
      if (avatar.behavioral?.keyObjections) {
        contentParts.push(`\n**Key Objections:** ${avatar.behavioral.keyObjections.join('; ')}`);
      }

      // Goals & Desires
      if (avatar.behavioral?.coreDesire) {
        contentParts.push(`\n**Core Desire:** ${avatar.behavioral.coreDesire.primary || avatar.behavioral.coreDesire}`);
        if (avatar.behavioral.coreDesire.description) {
          contentParts.push(` - ${avatar.behavioral.coreDesire.description}`);
        }
      }

      // Psychology & Psychographics
      if (avatar.psychology) {
        const psych = avatar.psychology;
        if (psych.sophistication) {
          contentParts.push(`\n**Market Sophistication:** ${psych.sophistication.label} (Level ${psych.sophistication.level})`);
        }
        if (psych.spiralDynamics) {
          contentParts.push(`\n**Values:** ${psych.spiralDynamics.primary}`);
        }
      }

      // Cognitive Biases (for persuasion)
      if (avatar.behavioral?.cognitiveBiases && Array.isArray(avatar.behavioral.cognitiveBiases)) {
        const biases = avatar.behavioral.cognitiveBiases.map((b: any) => b.name).filter(Boolean);
        if (biases.length > 0) {
          contentParts.push(`\n**Cognitive Biases:** ${biases.join(', ')}`);
        }
      }

      // Media Habits & Communication Preferences
      if (avatar.behavioral?.mediaHabits && Array.isArray(avatar.behavioral.mediaHabits)) {
        const media = avatar.behavioral.mediaHabits.map((m: any) => m.platform).filter(Boolean);
        if (media.length > 0) {
          contentParts.push(`\n**Media Habits:** ${media.join(', ')}`);
        }
      }

      // Trust & Risk
      if (avatar.trustSource) {
        contentParts.push(`\n**Trust Source:** ${avatar.trustSource}`);
      }
      if (avatar.riskTolerance) {
        contentParts.push(`\n**Risk Tolerance:** ${avatar.riskTolerance}`);
      }

      // Tech Context
      if (avatar.techContext && Array.isArray(avatar.techContext)) {
        contentParts.push(`\n**Tech Context:** ${avatar.techContext.join(', ')}`);
      }

      // Add search_content if available and not too long
      if (row.search_content && contentParts.length < 5) {
        contentParts.push(`\n\n${row.search_content}`);
      }

      return {
        id: row.id,
        title: `Customer Avatar: ${nickname}`,
        content: contentParts.join(''),
        resourceType: 'avatar',
        similarity: row.similarity,
        metadata: {
          name: nickname,
          status: row.status,
          versionSelected: row.version_selected,
          demographics: avatar.demographics,
          psychology: avatar.psychology,
          behavioral: avatar.behavioral,
          fullAvatarData: avatar,
        },
      };
    });
  }

  /**
   * Search research oracle reports
   * Extracts: market_intelligence, competitive_analysis, audience_analysis, 
   * psychographic_analysis, digital_presence, strategy_development, compliance, future_trends
   */
  private static async searchResearchReports(
    businessProfileId: string,
    embedding: number[],
    topK: number,
    threshold: number
  ): Promise<KnowledgeSearchResult[]> {
    const { data, error } = await supabase.rpc('match_research_reports', {
      query_embedding: embedding,
      match_threshold: threshold,
      match_count: topK,
      filter_business_profile_id: businessProfileId,
    });

    if (error || !data) {
      logger.debug('No research reports found or error:', error);
      return [];
    }

    return data.map((row: any) => {
      const contentParts: string[] = [];
      const reportTitle = row.custom_name || `Research Report: ${row.company_name || 'Unknown'}`;
      
      contentParts.push(`**${reportTitle}**`);
      
      if (row.industry_vertical) {
        contentParts.push(`Industry: ${row.industry_vertical}`);
      }
      if (row.target_audience) {
        contentParts.push(`Target Audience: ${row.target_audience}`);
      }

      // Extract sections from markdown_content (preferred) or module_outputs
      const markdown = row.markdown_content || {};
      const modules = row.module_outputs || {};

      // Market Intelligence
      if (markdown.market_intelligence || modules.market_intelligence) {
        const content = this.extractSectionContent(markdown.market_intelligence || modules.market_intelligence);
        if (content) {
          contentParts.push(`\n**Market Intelligence:**\n${content}`);
        }
      }

      // Competitive Analysis / Landscape
      if (markdown.competitive_landscape || modules.competitive_landscape || modules.competitive_analysis) {
        const content = this.extractSectionContent(
          markdown.competitive_landscape || modules.competitive_landscape || modules.competitive_analysis
        );
        if (content) {
          contentParts.push(`\n**Competitive Analysis:**\n${content}`);
        }
      }

      // Audience Analysis / Psychology
      if (markdown.audience_psychology || modules.audience_psychology || modules.audience_analysis) {
        const content = this.extractSectionContent(
          markdown.audience_psychology || modules.audience_psychology || modules.audience_analysis
        );
        if (content) {
          contentParts.push(`\n**Audience & Psychographic Analysis:**\n${content}`);
        }
      }

      // Executive Summary
      if (markdown.executive_summary || modules.executive_summary) {
        const content = this.extractSectionContent(markdown.executive_summary || modules.executive_summary);
        if (content) {
          contentParts.push(`\n**Executive Summary:**\n${content}`);
        }
      }

      // Opportunities
      if (row.opportunities && Array.isArray(row.opportunities) && row.opportunities.length > 0) {
        const opps = row.opportunities.slice(0, 5).map((o: any) => 
          typeof o === 'string' ? o : (o.description || o.title || JSON.stringify(o))
        );
        contentParts.push(`\n**Key Opportunities:**\n- ${opps.join('\n- ')}`);
      }

      // Threats
      if (row.threats && Array.isArray(row.threats) && row.threats.length > 0) {
        const threats = row.threats.slice(0, 5).map((t: any) => 
          typeof t === 'string' ? t : (t.description || t.title || JSON.stringify(t))
        );
        contentParts.push(`\n**Key Threats:**\n- ${threats.join('\n- ')}`);
      }

      // Extracted Facts (key insights)
      if (row.extracted_facts && typeof row.extracted_facts === 'object') {
        const facts = row.extracted_facts;
        if (facts.key_insights && Array.isArray(facts.key_insights)) {
          contentParts.push(`\n**Key Insights:**\n- ${facts.key_insights.slice(0, 5).join('\n- ')}`);
        }
      }

      // Fallback to search_content if we have minimal content
      if (contentParts.length < 4 && row.search_content) {
        contentParts.push(`\n${row.search_content.substring(0, 1000)}`);
      }

      return {
        id: row.id,
        title: reportTitle,
        content: contentParts.join('\n'),
        resourceType: 'research_report',
        similarity: row.similarity,
        metadata: {
          companyName: row.company_name,
          industryVertical: row.industry_vertical,
          targetAudience: row.target_audience,
          status: row.status,
          hasModuleOutputs: !!row.module_outputs,
          hasMarkdownContent: !!row.markdown_content,
          opportunities: row.opportunities,
          threats: row.threats,
          extractedFacts: row.extracted_facts,
        },
      };
    });
  }

  /**
   * Helper to extract content from section data (could be string, object, or markdown)
   */
  private static extractSectionContent(section: any): string {
    if (!section) return '';
    
    if (typeof section === 'string') {
      // Truncate if too long, preserve markdown
      return section.length > 800 ? section.substring(0, 800) + '...' : section;
    }
    
    if (typeof section === 'object') {
      // Try to extract text content from various structures
      if (section.content) return this.extractSectionContent(section.content);
      if (section.text) return this.extractSectionContent(section.text);
      if (section.summary) return this.extractSectionContent(section.summary);
      if (section.markdown) return this.extractSectionContent(section.markdown);
      
      // For arrays, join the items
      if (Array.isArray(section)) {
        return section.slice(0, 5).map(item => 
          typeof item === 'string' ? item : (item.text || item.content || JSON.stringify(item))
        ).join('\n');
      }
      
      // Last resort: stringify but limit length
      const str = JSON.stringify(section);
      return str.length > 500 ? str.substring(0, 500) + '...' : str;
    }
    
    return String(section);
  }

  /**
   * Search user uploaded business resources/documents
   */
  private static async searchBusinessResources(
    businessProfileId: string,
    embedding: number[],
    topK: number,
    threshold: number
  ): Promise<KnowledgeSearchResult[]> {
    const { data, error } = await supabase.rpc('match_user_business_resources', {
      query_embedding: embedding,
      match_threshold: threshold,
      match_count: topK,
      filter_business_profile_id: businessProfileId,
    });

    if (error || !data) {
      logger.debug('No business resources found or error:', error);
      return [];
    }

    return data.map((row: any) => {
      // Build content from multiple sources
      const contentParts = [];
      
      if (row.summary) {
        contentParts.push(row.summary);
      }
      if (row.search_content) {
        contentParts.push(row.search_content);
      }
      if (row.raw_analysis_content) {
        // Truncate if very long
        const analysis = row.raw_analysis_content.length > 1000 
          ? row.raw_analysis_content.substring(0, 1000) + '...' 
          : row.raw_analysis_content;
        contentParts.push(`\n**Analysis:** ${analysis}`);
      }

      return {
        id: row.id,
        title: row.title || 'Uploaded Document',
        content: contentParts.join('\n') || 'No content available',
        resourceType: 'business_resource',
        similarity: row.similarity,
        metadata: {
          resourceType: row.resource_type,
          fileType: row.file_type,
          aiTags: row.ai_tags,
          contextProfile: row.context_profile,
        },
      };
    });
  }

  /**
   * Format knowledge results for AI consumption
   */
  static formatForAI(results: KnowledgeSearchResult[]): string {
    if (results.length === 0) {
      return 'No relevant knowledge found in business resources.';
    }

    // Group results by type for better organization
    const grouped = results.reduce((acc, result) => {
      const type = result.resourceType;
      if (!acc[type]) acc[type] = [];
      acc[type].push(result);
      return acc;
    }, {} as Record<string, KnowledgeSearchResult[]>);

    const typeLabels: Record<string, string> = {
      'brand_guidelines': '🎨 Brand Guidelines',
      'offer': '💼 Offers',
      'testimonial': '⭐ Testimonials',
      'case_study': '📊 Case Studies',
      'handbook': '📖 Copywriting Handbooks',
      'avatar': '👤 Customer Avatars',
      'research_report': '🔬 Research Oracle Reports',
      'business_resource': '📁 Business Resources',
    };

    const sections: string[] = [];

    // Format each group
    for (const [type, typeResults] of Object.entries(grouped)) {
      const label = typeLabels[type] || type;
      sections.push(`## ${label}\n`);

      typeResults.forEach((result, index) => {
        const matchPercent = (result.similarity * 100).toFixed(1);
        sections.push(
          `### ${index + 1}. ${result.title} (${matchPercent}% match)\n`
        );
        
        // Show more content for highly relevant results
        const maxLength = result.similarity > 0.7 ? 800 : 500;
        const content = result.content.length > maxLength 
          ? result.content.substring(0, maxLength) + '...' 
          : result.content;
        
        sections.push(content);
        sections.push('\n');
      });
    }

    return sections.join('\n');
  }

  /**
   * Get all available resource types for a business profile
   * Useful for showing what's available before searching
   */
  static async getAvailableResourceTypes(businessProfileId: string): Promise<string[]> {
    const availableTypes: string[] = [];

    // Check each resource type for existence
    const checks = await Promise.all([
      supabase.from('brand_guidelines').select('id').eq('business_profile_id', businessProfileId).limit(1),
      supabase.from('offers').select('id').eq('business_profile_id', businessProfileId).eq('status', 'active').limit(1),
      supabase.from('testimonials').select('id').eq('business_profile_id', businessProfileId).limit(1),
      supabase.from('case_studies').select('id').eq('business_profile_id', businessProfileId).limit(1),
      supabase.from('copywritinghandbook_completed').select('id').eq('business_profile_id', businessProfileId).eq('status', 'completed').limit(1),
      supabase.from('avatars').select('id').eq('business_profile_id', businessProfileId).limit(1),
      supabase.schema('research_oracle').from('research_reports').select('id').eq('business_profile_id', businessProfileId).eq('status', 'completed').limit(1),
      supabase.from('user_business_resources').select('id').eq('business_profile_id', businessProfileId).eq('upload_status', 'completed').limit(1),
    ]);

    const typeNames = ['brand_guidelines', 'offer', 'testimonial', 'case_study', 'handbook', 'avatar', 'research_report', 'business_resource'];
    
    checks.forEach((result, index) => {
      if (result.data && result.data.length > 0) {
        availableTypes.push(typeNames[index]);
      }
    });

    return availableTypes;
  }
}

