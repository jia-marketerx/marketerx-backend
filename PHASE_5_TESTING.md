# Phase 5: Tool Integration - Testing Guide

## ✅ What Was Implemented

### 1. Canon System
- **Database**: `marketerx_canons` table with vector embeddings
- **Sample Data**: 4 canons (AIDA framework, PAS framework, Product Launch template, CAN-SPAM compliance)
- **Service**: Canon fetching with 7-day Redis caching
- **Tool**: `fetch_canon` - loads frameworks/templates/compliance rules

### 2. Caching Infrastructure
- **Unified Service**: `CacheService` with multiple layers
- **Cache Layers**:
  - Session (30 min TTL)
  - Knowledge (24 hour TTL)
  - Canon (7 day TTL)
  - HTTP (5 min TTL)
- **Pattern**: Cache-aside with `getOrSet` helper

### 3. Knowledge Search
- **Vector Functions**: 5 SQL functions for semantic search
  - `match_brand_guidelines`
  - `match_offers`
  - `match_testimonials`
  - `match_case_studies`
  - `match_handbooks`
- **Service**: Searches across business resources using OpenAI embeddings
- **Tool**: `knowledge_search` - semantic search across user's knowledge base

### 4. Web Search
- **Provider**: Tavily API (optimized for AI agents)
- **Modes**: Basic (5 sources, fast) and Advanced (20 sources, comprehensive)
- **Caching**: 5-minute TTL for search results
- **Tool**: `web_search` - real-time web search with AI-generated summaries

### 5. Tier 1 Orchestrator Updates
- **Canon-First Workflow**: Agent loads canon immediately after intent analysis
- **Tool Calling**: Streaming tool execution with result processing
- **SSE Events**: Tool status updates and analysis summaries
- **System Prompt**: Updated with Canon-First architecture guidance

## 🧪 Test Cases

### Test 1: Basic Conversation (No Tools)
**Goal**: Verify agent works without tool calls

```bash
# Start server
npm run dev

# In browser: http://localhost:5000/test-chat.html
Message: "Hi, tell me about yourself"
Expected: Agent responds with introduction, no tool calls
```

### Test 2: Canon Fetch (Email)
**Goal**: Verify canon loading works

```
Message: "I need to create an email campaign"
Expected:
- Tool call: fetch_canon (category=all, contentType=email)
- Response includes: AIDA framework, Product Launch template, CAN-SPAM compliance
- Agent uses canon to guide response
```

### Test 3: Knowledge Search
**Goal**: Verify semantic search across business resources

**Prerequisites**: User must have business resources in database
- Brand guidelines
- Offers
- Testimonials
- Case studies
- Copywriting handbooks

```
Message: "What are my brand colors and tone?"
Expected:
- Tool call: knowledge_search (query about brand)
- Returns brand guidelines with similarity scores
- Agent synthesizes findings in response
```

### Test 4: Web Search (Basic)
**Goal**: Verify real-time web search

```
Message: "What are the latest email marketing trends for 2026?"
Expected:
- Tool call: web_search (query about email trends, searchDepth=basic)
- Returns 5-10 sources
- AI-generated summary from Tavily
- Agent formats results in response
```

### Test 5: Web Search (Advanced)
**Goal**: Verify deep web search

```
Message: "Research competitor email strategies for SaaS companies"
Expected:
- Tool call: web_search (query about competitors, searchDepth=advanced)
- Returns up to 20 sources
- Comprehensive analysis
```

### Test 6: Canon-First Workflow (Full Flow)
**Goal**: Verify Canon → Knowledge → Web flow

```
Message: "Create an email campaign for my [product name]"
Expected Flow:
1. fetch_canon (email) → loads AIDA, templates, compliance
2. knowledge_search → finds offer details, brand guidelines
3. (Optional) web_search → current email trends if needed
4. Agent synthesizes all sources into strategic advice
```

### Test 7: Tool Caching
**Goal**: Verify Redis caching works

```
1st Request: "I need email help" → fetch_canon called (slow)
2nd Request: "More email guidance" → fetch_canon cached (fast)

Check logs for:
- "Canon cache warmed successfully"
- Cache hits in Redis
```

### Test 8: Knowledge Search Filtering
**Goal**: Verify resource type filtering

```
Message: "Show me my testimonials about [feature]"
Expected:
- Tool call: knowledge_search (resourceTypes=["testimonial"])
- Only returns testimonials, not other resources
```

### Test 9: Error Handling
**Goal**: Verify graceful tool failure

```
# Simulate: Break Redis connection or Tavily API key

Message: "Search the web"
Expected:
- Tool call attempts
- Error logged
- Agent continues with graceful error message
- No crash
```

### Test 10: SSE Event Streaming
**Goal**: Verify frontend receives tool events

**Watch browser console for SSE events:**

```javascript
// Expected events:
event: thinking { type: "agent_reasoning", content: "..." }
event: thinking { type: "tool_status", content: "Executing fetch_canon..." }
event: analysis { type: "canon_loaded", content: "Canon loaded: 4 rules" }
event: thinking { type: "tool_status", content: "✅ fetch_canon completed" }
event: message { role: "assistant", content: "..." }
event: done { conversationId: "...", messageCount: 2 }
```

## 📊 Verification Checklist

- [ ] Canon table created with 4 sample canons
- [ ] Vector search functions created (5 SQL functions)
- [ ] Redis cache working (check logs for cache hits)
- [ ] Agent can fetch canon without errors
- [ ] Agent can search knowledge base (if resources exist)
- [ ] Agent can perform web search (requires Tavily API key)
- [ ] Tool results streamed to frontend via SSE
- [ ] Tool calls tracked in `marketerx_messages` table
- [ ] No TypeScript errors
- [ ] No linting errors
- [ ] Health check passes for all services

## 🔍 Debugging Tips

### Check Canon Data
```sql
-- View all canons
SELECT id, category, content_type, name, priority, is_active 
FROM marketerx_canons 
ORDER BY priority DESC;

-- Should return 4 rows (AIDA, PAS, Product Launch, CAN-SPAM)
```

### Check Redis Cache
```bash
# If using Redis CLI
redis-cli KEYS "marketerx:canon:*"
redis-cli GET "marketerx:canon:<key>"
```

### Check Tool Execution Logs
```bash
# Watch server logs for:
"🔧 Executing fetch_canon: ..."
"✅ fetch_canon completed"
"🔍 Performing web search: ..."
```

### Check Database Vector Functions
```sql
-- Test brand guidelines search
SELECT * FROM match_brand_guidelines(
  ARRAY[0.1, 0.2, ...]::vector(1536), -- dummy embedding
  0.5, -- threshold
  5,   -- limit
  'user-business-profile-id'
);
```

## 🚀 Next Steps

**Phase 6**: Tier 2 Content Execution
- Build stateless content generation agent
- Artifact streaming with XML markers
- Content templates and formatting
- Multi-step content creation workflow

**Phase 7**: Caching & Performance Optimization
- Anthropic prompt caching (90% cost reduction)
- Session state caching
- Database query optimization
- Load testing and benchmarking

## 📝 Notes

- **Canon Schema**: Flexible JSONB allows different structures per category
- **Knowledge Search**: Requires existing embeddings in database
- **Web Search**: Tavily API key required (`TAVILY_API_KEY` in `.env`)
- **Caching**: Redis connection required (`REDIS_URL` in `.env`)
- **Vector Search**: Uses cosine similarity with 0.7 default threshold

## ⚠️ Known Limitations

- Tool results not fed back to agent for multi-turn reasoning (Phase 6)
- No content generation yet (Phase 6: Tier 2 agent)
- No Anthropic prompt caching yet (Phase 7)
- Canon embeddings not generated (manual insertion only)
- Knowledge search requires pre-existing embeddings in database


