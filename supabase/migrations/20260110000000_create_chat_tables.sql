-- =====================================================
-- CHAT SYSTEM TABLES
-- Purpose: Store conversations and messages for MarketerX chat
-- =====================================================

-- =====================================================
-- 1. CONVERSATIONS TABLE
-- Stores chat conversations linked to users and business profiles
-- =====================================================
CREATE TABLE IF NOT EXISTS public.marketerx_conversations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    business_profile_id uuid NOT NULL REFERENCES public.business_profiles(id) ON DELETE CASCADE,
    
    -- Conversation metadata
    title text NOT NULL DEFAULT 'New Conversation',
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
    
    -- Timestamps
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    last_message_at timestamptz DEFAULT now()
);

-- =====================================================
-- 2. MESSAGES TABLE
-- Stores individual messages within conversations
-- =====================================================
CREATE TABLE IF NOT EXISTS public.marketerx_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id uuid NOT NULL REFERENCES public.marketerx_conversations(id) ON DELETE CASCADE,
    
    -- Message content
    role text NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
    content text NOT NULL,
    message_order integer NOT NULL,
    
    -- Token tracking
    input_tokens integer,
    output_tokens integer,
    
    -- Agent metadata
    agent_id text, -- tier1-orchestrator, tier2-content-execution
    tool_calls jsonb, -- Tools called in this message
    tool_results jsonb, -- Results from tool calls
    thinking_entries jsonb DEFAULT '[]'::jsonb, -- Agent reasoning steps
    
    -- Additional metadata
    metadata jsonb DEFAULT '{}'::jsonb,
    
    -- Embeddings for semantic search
    embedding vector(1536), -- OpenAI text-embedding-3-large
    
    -- Timestamps
    created_at timestamptz DEFAULT now()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Conversations indexes
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON public.marketerx_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_business_profile ON public.marketerx_conversations(business_profile_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON public.marketerx_conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON public.marketerx_conversations(last_message_at DESC);

-- Messages indexes
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.marketerx_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_role ON public.marketerx_messages(role);
CREATE INDEX IF NOT EXISTS idx_messages_order ON public.marketerx_messages(conversation_id, message_order);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.marketerx_messages(created_at DESC);

-- Vector search for messages
CREATE INDEX IF NOT EXISTS idx_messages_embedding ON public.marketerx_messages 
USING hnsw (embedding vector_cosine_ops)
WHERE embedding IS NOT NULL;

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS
ALTER TABLE public.marketerx_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketerx_messages ENABLE ROW LEVEL SECURITY;

-- Conversations: Users can only access their own conversations
CREATE POLICY "Users can view their own conversations" 
    ON public.marketerx_conversations FOR SELECT 
    USING (user_id = auth.uid());

CREATE POLICY "Users can create their own conversations" 
    ON public.marketerx_conversations FOR INSERT 
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own conversations" 
    ON public.marketerx_conversations FOR UPDATE 
    USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own conversations" 
    ON public.marketerx_conversations FOR DELETE 
    USING (user_id = auth.uid());

-- Messages: Users can only access messages from their conversations
CREATE POLICY "Users can view messages from their conversations" 
    ON public.marketerx_messages FOR SELECT 
    USING (
        conversation_id IN (
            SELECT id FROM public.marketerx_conversations 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert messages to their conversations" 
    ON public.marketerx_messages FOR INSERT 
    WITH CHECK (
        conversation_id IN (
            SELECT id FROM public.marketerx_conversations 
            WHERE user_id = auth.uid()
        )
    );

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Update last_message_at when a new message is inserted
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.marketerx_conversations
    SET last_message_at = NEW.created_at,
        updated_at = NEW.created_at
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_last_message_trigger 
    AFTER INSERT ON public.marketerx_messages
    FOR EACH ROW EXECUTE FUNCTION update_conversation_last_message();

-- Update updated_at timestamp for conversations
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON public.marketerx_conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.marketerx_conversations IS 'Chat conversations for MarketerX AI assistant';
COMMENT ON TABLE public.marketerx_messages IS 'Individual messages within conversations';

