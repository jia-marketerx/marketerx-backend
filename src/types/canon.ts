/**
 * Canon Types for MarketerX
 * 
 * Canon represents proprietary frameworks, templates, and compliance rules
 * that guide AI content generation.
 */

export enum CanonCategory {
  Template = 'template',
  Framework = 'framework',
  Compliance = 'compliance',
}

export enum CanonContentType {
  Email = 'email',
  Ad = 'ad',
  LandingPage = 'landing-page',
  Script = 'script',
  General = 'general',
}

export interface Canon {
  id: string;
  category: CanonCategory;
  content_type: CanonContentType;
  name: string;
  description: string | null;
  version: number;
  content: Record<string, any>; // Flexible JSONB
  instructions: string | null;
  search_keywords: string[] | null;
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  embedding: number[] | null;
  search_content: string | null;
}

export interface CanonFetchOptions {
  category?: CanonCategory | 'all';
  contentType?: CanonContentType;
  limit?: number;
  includeInactive?: boolean;
}

export interface CanonSearchOptions {
  query: string;
  contentType?: CanonContentType;
  limit?: number;
}

