-- =====================================================
-- CANON SYSTEM TABLES
-- Purpose: Store proprietary frameworks, templates, and compliance rules
-- =====================================================

-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- =====================================================
-- 1. CANON CATEGORIES TABLE
-- Stores different types of canon (template, framework, compliance, style)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.canon_categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    description text,
    sort_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Insert default categories
INSERT INTO public.canon_categories (name, description, sort_order) VALUES
    ('template', 'Pre-defined content templates with structure and placeholders', 1),
    ('framework', 'Proprietary methodologies and strategic frameworks', 2),
    ('compliance', 'Legal requirements, brand guidelines, and approval rules', 3),
    ('style', 'Tone of voice, writing style, and formatting preferences', 4)
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- 2. CANON ITEMS TABLE
-- Individual canon entries with content and metadata
-- =====================================================
CREATE TABLE IF NOT EXISTS public.canon_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_profile_id uuid NOT NULL REFERENCES public.business_profiles(id) ON DELETE CASCADE,
    category_id uuid NOT NULL REFERENCES public.canon_categories(id) ON DELETE RESTRICT,
    
    -- Content identification
    title text NOT NULL,
    slug text NOT NULL, -- For easy reference (e.g., 'email-welcome-template')
    description text,
    
    -- Content type specificity
    content_type text NOT NULL CHECK (content_type IN ('email', 'ad', 'landing-page', 'script', 'universal')),
    
    -- Actual canon content
    content jsonb NOT NULL, -- Flexible structure for different canon types
    
    -- Metadata
    tags text[] DEFAULT '{}',
    priority integer DEFAULT 0, -- Higher priority items loaded first
    version integer DEFAULT 1,
    is_active boolean DEFAULT true,
    
    -- Usage tracking
    usage_count integer DEFAULT 0,
    last_used_at timestamptz,
    
    -- Embeddings for semantic search
    embedding vector(1536), -- OpenAI text-embedding-3-large
    
    -- Timestamps
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    created_by uuid REFERENCES auth.users(id),
    
    -- Unique constraint per business profile
    UNIQUE(business_profile_id, slug)
);

-- =====================================================
-- 3. BUSINESS RESOURCES TABLE
-- User-uploaded documents, guidelines, and knowledge base
-- =====================================================
CREATE TABLE IF NOT EXISTS public.business_resources (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_profile_id uuid NOT NULL REFERENCES public.business_profiles(id) ON DELETE CASCADE,
    
    -- Resource identification
    title text NOT NULL,
    description text,
    resource_type text NOT NULL CHECK (resource_type IN ('document', 'guideline', 'reference', 'example', 'asset')),
    
    -- Content storage
    content_text text, -- Extracted text content for search
    file_url text, -- Supabase Storage URL if uploaded file
    file_type text, -- mime type
    file_size_bytes bigint,
    
    -- Metadata
    tags text[] DEFAULT '{}',
    source text, -- Where this came from (uploaded, imported, etc.)
    
    -- Embeddings for semantic search
    embedding vector(1536),
    
    -- Usage tracking
    access_count integer DEFAULT 0,
    last_accessed_at timestamptz,
    
    -- Status
    is_indexed boolean DEFAULT false, -- Has embedding been generated?
    is_active boolean DEFAULT true,
    
    -- Timestamps
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    created_by uuid REFERENCES auth.users(id)
);

-- =====================================================
-- 4. CANON USAGE LOG
-- Track when and how canon items are used
-- =====================================================
CREATE TABLE IF NOT EXISTS public.canon_usage_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    canon_item_id uuid NOT NULL REFERENCES public.canon_items(id) ON DELETE CASCADE,
    conversation_id uuid REFERENCES public.marketerx_conversations(id) ON DELETE SET NULL,
    business_profile_id uuid NOT NULL REFERENCES public.business_profiles(id) ON DELETE CASCADE,
    
    -- Context of usage
    content_type text NOT NULL,
    user_query text,
    
    -- Performance metrics
    was_cached boolean DEFAULT false,
    load_time_ms integer,
    
    -- Timestamps
    used_at timestamptz DEFAULT now()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Canon items indexes
CREATE INDEX IF NOT EXISTS idx_canon_items_business_profile ON public.canon_items(business_profile_id);
CREATE INDEX IF NOT EXISTS idx_canon_items_category ON public.canon_items(category_id);
CREATE INDEX IF NOT EXISTS idx_canon_items_content_type ON public.canon_items(content_type);
CREATE INDEX IF NOT EXISTS idx_canon_items_active ON public.canon_items(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_canon_items_priority ON public.canon_items(priority DESC);
CREATE INDEX IF NOT EXISTS idx_canon_items_slug ON public.canon_items(business_profile_id, slug);

-- Vector search indexes (using HNSW for faster similarity search)
CREATE INDEX IF NOT EXISTS idx_canon_items_embedding ON public.canon_items 
USING hnsw (embedding vector_cosine_ops)
WHERE embedding IS NOT NULL;

-- Business resources indexes
CREATE INDEX IF NOT EXISTS idx_business_resources_profile ON public.business_resources(business_profile_id);
CREATE INDEX IF NOT EXISTS idx_business_resources_type ON public.business_resources(resource_type);
CREATE INDEX IF NOT EXISTS idx_business_resources_active ON public.business_resources(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_business_resources_indexed ON public.business_resources(is_indexed) WHERE is_indexed = true;

-- Vector search for resources
CREATE INDEX IF NOT EXISTS idx_business_resources_embedding ON public.business_resources 
USING hnsw (embedding vector_cosine_ops)
WHERE embedding IS NOT NULL;

-- Usage log indexes
CREATE INDEX IF NOT EXISTS idx_canon_usage_log_canon_item ON public.canon_usage_log(canon_item_id);
CREATE INDEX IF NOT EXISTS idx_canon_usage_log_conversation ON public.canon_usage_log(conversation_id);
CREATE INDEX IF NOT EXISTS idx_canon_usage_log_used_at ON public.canon_usage_log(used_at DESC);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS
ALTER TABLE public.canon_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canon_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canon_usage_log ENABLE ROW LEVEL SECURITY;

-- Canon categories: Public read, admin write
CREATE POLICY "Canon categories are viewable by all users" 
    ON public.canon_categories FOR SELECT 
    USING (true);

-- Canon items: Users can only see their business profile's canon
CREATE POLICY "Users can view their business canon items" 
    ON public.canon_items FOR SELECT 
    USING (
        business_profile_id IN (
            SELECT id FROM public.business_profiles 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert canon for their business" 
    ON public.canon_items FOR INSERT 
    WITH CHECK (
        business_profile_id IN (
            SELECT id FROM public.business_profiles 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their business canon items" 
    ON public.canon_items FOR UPDATE 
    USING (
        business_profile_id IN (
            SELECT id FROM public.business_profiles 
            WHERE user_id = auth.uid()
        )
    );

-- Business resources: Similar RLS as canon
CREATE POLICY "Users can view their business resources" 
    ON public.business_resources FOR SELECT 
    USING (
        business_profile_id IN (
            SELECT id FROM public.business_profiles 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert resources for their business" 
    ON public.business_resources FOR INSERT 
    WITH CHECK (
        business_profile_id IN (
            SELECT id FROM public.business_profiles 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their business resources" 
    ON public.business_resources FOR UPDATE 
    USING (
        business_profile_id IN (
            SELECT id FROM public.business_profiles 
            WHERE user_id = auth.uid()
        )
    );

-- Usage log: Users can view their own usage
CREATE POLICY "Users can view their canon usage logs" 
    ON public.canon_usage_log FOR SELECT 
    USING (
        business_profile_id IN (
            SELECT id FROM public.business_profiles 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "System can insert usage logs" 
    ON public.canon_usage_log FOR INSERT 
    WITH CHECK (true);

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_canon_categories_updated_at BEFORE UPDATE ON public.canon_categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_canon_items_updated_at BEFORE UPDATE ON public.canon_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_business_resources_updated_at BEFORE UPDATE ON public.business_resources
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update usage count when canon item is used
CREATE OR REPLACE FUNCTION increment_canon_usage()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.canon_items
    SET usage_count = usage_count + 1,
        last_used_at = NEW.used_at
    WHERE id = NEW.canon_item_id;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER increment_canon_usage_trigger 
    AFTER INSERT ON public.canon_usage_log
    FOR EACH ROW EXECUTE FUNCTION increment_canon_usage();

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to search canon items by similarity
CREATE OR REPLACE FUNCTION search_canon_by_similarity(
    p_business_profile_id uuid,
    p_query_embedding vector(1536),
    p_content_type text DEFAULT NULL,
    p_category_id uuid DEFAULT NULL,
    p_limit integer DEFAULT 5
)
RETURNS TABLE (
    id uuid,
    title text,
    slug text,
    description text,
    content jsonb,
    content_type text,
    similarity float
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ci.id,
        ci.title,
        ci.slug,
        ci.description,
        ci.content,
        ci.content_type,
        1 - (ci.embedding <=> p_query_embedding) as similarity
    FROM public.canon_items ci
    WHERE ci.business_profile_id = p_business_profile_id
        AND ci.is_active = true
        AND ci.embedding IS NOT NULL
        AND (p_content_type IS NULL OR ci.content_type = p_content_type OR ci.content_type = 'universal')
        AND (p_category_id IS NULL OR ci.category_id = p_category_id)
    ORDER BY ci.embedding <=> p_query_embedding
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to search business resources by similarity
CREATE OR REPLACE FUNCTION search_resources_by_similarity(
    p_business_profile_id uuid,
    p_query_embedding vector(1536),
    p_resource_type text DEFAULT NULL,
    p_limit integer DEFAULT 5
)
RETURNS TABLE (
    id uuid,
    title text,
    description text,
    content_text text,
    resource_type text,
    file_url text,
    tags text[],
    similarity float
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        br.id,
        br.title,
        br.description,
        br.content_text,
        br.resource_type,
        br.file_url,
        br.tags,
        1 - (br.embedding <=> p_query_embedding) as similarity
    FROM public.business_resources br
    WHERE br.business_profile_id = p_business_profile_id
        AND br.is_active = true
        AND br.is_indexed = true
        AND br.embedding IS NOT NULL
        AND (p_resource_type IS NULL OR br.resource_type = p_resource_type)
    ORDER BY br.embedding <=> p_query_embedding
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- SAMPLE DATA FOR TESTING
-- =====================================================

-- Note: Sample data will be inserted separately after business profiles are confirmed
-- This migration only creates the schema structure

COMMENT ON TABLE public.canon_items IS 'Stores proprietary frameworks, templates, and compliance rules for content generation';
COMMENT ON TABLE public.business_resources IS 'User-uploaded knowledge base documents and reference materials';
COMMENT ON TABLE public.canon_usage_log IS 'Tracks canon usage for analytics and optimization';

