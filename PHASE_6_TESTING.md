# Phase 6 Testing Guide: Two-Tier Content Generation

## Overview

Phase 6 implements the complete two-tier architecture with Tier 2 content execution agent. This guide covers testing all content generation capabilities.

## Architecture

```
User Message
    ↓
Tier 1 Orchestrator (Claude Sonnet)
    ↓
1. Load Canon (frameworks + templates)
2. Search Knowledge (brand guidelines)
3. Optional Web Search
4. Build Comprehensive Brief
    ↓
5. Call content_execution → Tier 2 Executor (Haiku)
    ↓
6. Stream Generated Content (artifact events)
7. Save to Database (marketerx_artifacts)
    ↓
8. Validate Content (against canon rules)
    ↓
9. Present to User
```

---

## Test Setup

### Prerequisites

1. **Server Running**: `npm run dev`
2. **Browser**: Open `test-chat.html` in browser
3. **Database**: Canon data loaded (Phase 5)
4. **Credentials**: All API keys configured

### Expected SSE Events

```typescript
// Content generation flow
thinking → "Analyzing request..."
thinking → "Loading canon..."
analysis → "Canon loaded"
thinking → "Searching knowledge..."
analysis → "Knowledge found"
thinking → "Building brief..."
thinking → "Calling content_execution..."
analysis → "Generating content..."
artifact → start
artifact → delta (streaming chunks)
artifact → delta (streaming chunks)
...
artifact → end
analysis → "Content generated"
thinking → "Validating content..."
analysis → "Validation complete"
message → "Here's your [content type]..." (final response)
done → Conversation complete
```

---

## Test Suite

### Test 1: Email Generation

**Goal**: Generate a complete email with AIDA framework

**Message**: 
```
Create a welcome email for new users who just signed up for our AI writing tool
```

**Expected Behavior**:

1. **Tier 1 Actions**:
   - ✅ Calls `fetch_canon` (category=all, contentType=email)
   - ✅ Calls `knowledge_search` (if brand guidelines exist)
   - ✅ Builds brief with purpose, audience, tone
   - ✅ Calls `content_execution` with email brief

2. **Tier 2 Generation**:
   - ✅ `artifact/start` event fires
   - ✅ `artifact/delta` events stream content word-by-word
   - ✅ Generated content includes:
     * Subject line (< 50 chars)
     * Preheader text
     * Email body with paragraphs
     * Clear CTA
     * Signature
   - ✅ Content wrapped in `<artifact>` XML tags
   - ✅ `artifact/end` event fires

3. **Validation**:
   - ✅ Calls `validate_content`
   - ✅ Checks for CAN-SPAM compliance
   - ✅ Returns status: passed/warning/failed

4. **Database**:
   - ✅ Artifact saved to `marketerx_artifacts`
   - ✅ Linked to conversation and message
   - ✅ Metadata includes: model, tokens, generation time

5. **Frontend Display**:
   - ✅ Shows "Generating email..." status
   - ✅ Streams content in real-time
   - ✅ Shows validation results
   - ✅ Final message with complete email

**Validation Checks**:
```
✅ Subject line present
✅ CTA included
⚠️ Consider adding unsubscribe link
⚠️ Consider adding company address
```

---

### Test 2: Ad Copy Generation

**Goal**: Generate platform-specific ad copy

**Message**: 
```
Write a Facebook ad for our SaaS product targeting small business owners
```

**Expected Behavior**:

1. **Tier 1 Actions**:
   - ✅ Loads canon (ad frameworks)
   - ✅ Searches knowledge (product info, brand tone)
   - ✅ Builds brief with platform, objective, audience
   - ✅ Calls `content_execution` with ad brief

2. **Tier 2 Generation**:
   - ✅ Streams artifact
   - ✅ Generated content includes:
     * Headline (< 40 chars)
     * Primary text (Facebook optimal length)
     * Description
     * CTA
     * Optional: 2-3 variations for A/B testing
   - ✅ Platform-optimized format

3. **Content Quality**:
   - ✅ Attention-grabbing headline
   - ✅ Benefit-focused copy
   - ✅ Social proof if available
   - ✅ Clear action-oriented CTA

**Validation Checks**:
```
✅ Headline within character limit
✅ CTA present
✅ All compliance checks passed
```

---

### Test 3: Landing Page Generation

**Goal**: Generate complete landing page structure

**Message**: 
```
Create a landing page for our new AI writing assistant targeting content creators
```

**Expected Behavior**:

1. **Tier 1 Actions**:
   - ✅ Loads canon (landing page templates)
   - ✅ Searches knowledge (product features, testimonials)
   - ✅ Builds comprehensive brief
   - ✅ Calls `content_execution` with landing page brief

2. **Tier 2 Generation**:
   - ✅ Streams long-form content
   - ✅ Generated sections:
     * Hero (headline + subheadline + CTA)
     * Problem/Solution
     * Features/Benefits (3-5)
     * Social Proof (testimonials + stats)
     * How It Works (3-4 steps)
     * FAQ (5-7 questions)
     * Final CTA
   - ✅ Proper XML structure

3. **Content Quality**:
   - ✅ Clear value proposition
   - ✅ Benefit-driven (not feature-focused)
   - ✅ Persuasive copy throughout
   - ✅ Single conversion goal

**Note**: This is the longest content type, expect 30-60 seconds generation time.

---

### Test 4: Script Generation

**Goal**: Generate video/audio script

**Message**: 
```
Write a 60-second YouTube video script explaining the benefits of our AI writing tool
```

**Expected Behavior**:

1. **Tier 1 Actions**:
   - ✅ Loads canon (script frameworks)
   - ✅ Searches knowledge (product benefits)
   - ✅ Builds brief with format, duration, purpose
   - ✅ Calls `content_execution` with script brief

2. **Tier 2 Generation**:
   - ✅ Streams script content
   - ✅ Generated content includes:
     * Hook (first 3-5 seconds)
     * Intro
     * Main content (problem → solution → proof)
     * CTA
     * Production notes
   - ✅ Visual directions marked as `[VISUAL: ...]`
   - ✅ Pacing notes with `[PAUSE]`
   - ✅ Estimated word count for duration

3. **Content Quality**:
   - ✅ Strong hook (pattern interrupt)
   - ✅ Natural, conversational tone
   - ✅ Visual and audio cues
   - ✅ Clear call-to-action

---

## Test 5: Validation Scenarios

### Test 5A: Validation PASS

**Message**: 
```
Create a product launch email with all compliance requirements
```

**Expected**:
```
✅ Validation Status: PASSED
✅ All compliance checks passed!
```

### Test 5B: Validation WARNING

**Message**: 
```
Write a quick promotional email
```

**Expected**:
```
⚠️ Validation Status: WARNING
⚠️ Warnings:
  - Consider adding unsubscribe link for CAN-SPAM compliance
  - Consider adding company physical address
```

### Test 5C: Validation FAIL

**Message**: 
```
Create an email with subject line: "FREE!!! URGENT - ACT NOW!!!"
```

**Expected**:
```
❌ Validation Status: FAILED
❌ Issues:
  - Missing unsubscribe link (CAN-SPAM requirement)
⚠️ Warnings:
  - Subject line contains potential spam trigger words
```

---

## Test 6: Error Handling

### Test 6A: Invalid Content Type

**Test**: Manually trigger with invalid type

**Expected**:
- Error message
- No crash
- User-friendly error

### Test 6B: Brief Missing Required Fields

**Test**: Incomplete brief data

**Expected**:
- Tier 2 handles gracefully
- Generates best-effort content
- Or returns clear error

---

## Test 7: Database Verification

After any content generation test:

```sql
-- Check artifact was saved
SELECT * FROM marketerx_artifacts 
WHERE conversation_id = '[your-conversation-id]'
ORDER BY created_at DESC 
LIMIT 1;

-- Verify structure
{
  id: uuid,
  conversation_id: uuid,
  message_id: uuid,
  user_id: uuid,
  content_type: 'email' | 'ad' | 'landing-page' | 'script',
  title: string,
  content: string (full artifact),
  metadata: {
    model: 'claude-3-5-haiku-20241022',
    tokensUsed: number,
    generationTimeMs: number,
    validationStatus: 'passed' | 'warning' | 'failed',
    validationIssues: [],
    canonVersion: string
  },
  created_at: timestamp
}
```

---

## Test 8: Performance Metrics

Track these metrics during testing:

| Content Type | Expected Generation Time | Token Usage |
|--------------|-------------------------|-------------|
| Email        | 5-10 seconds            | 500-1000    |
| Ad Copy      | 3-7 seconds             | 300-600     |
| Landing Page | 30-60 seconds           | 2000-4000   |
| Script       | 10-20 seconds           | 800-1500    |

**Streaming Quality**:
- Content should stream word-by-word (not all at once)
- No long pauses > 3 seconds
- Consistent streaming speed

---

## Test 9: Multi-Content Conversation

**Goal**: Test conversation continuity with multiple content generations

**Flow**:
```
User: "Create an email for product launch"
→ Email generated

User: "Now create a Facebook ad for the same launch"
→ Ad generated (should reference previous context)

User: "Make the ad more urgent"
→ Regenerated with urgency
```

**Expected**:
- ✅ Context preserved across generations
- ✅ Each artifact saved separately
- ✅ Conversation history maintained

---

## Test 10: Frontend Integration

### Check `test-chat.html` displays:

1. **Artifact Events**:
   ```javascript
   case 'artifact':
     if (data.type === 'start') {
       // Show "Generating..." indicator
     } else if (data.type === 'delta') {
       // Append chunk to artifact display
     } else if (data.type === 'end') {
       // Show "Complete" status
     }
   ```

2. **Analysis Events**:
   - "Canon loaded: X rules"
   - "Generating content..."
   - "✅ Email generated (500 tokens)"
   - "Validation: passed"

3. **Visual Indicators**:
   - 🎨 Icon for artifact generation
   - ✅ Success checkmark
   - ⚠️ Warning icon
   - ❌ Error icon

---

## Common Issues & Solutions

### Issue 1: Content Not Streaming

**Symptom**: Entire content appears at once

**Fix**: Verified in recent commit - streaming now works on all iterations

### Issue 2: Validation Always Passes

**Symptom**: No warnings or errors

**Fix**: Canon must have compliance_rules array populated

**Check**:
```sql
SELECT compliance_rules FROM marketerx_canons WHERE content_type = 'email';
```

### Issue 3: Artifact Not Saved

**Symptom**: Content generates but not in database

**Possible causes**:
- Missing userId or conversationId
- RLS policy blocking
- Database connection issue

**Fix**: Check server logs for error details

### Issue 4: Tier 2 Timeout

**Symptom**: Long generation hangs

**Fix**: Check Anthropic API status, verify API key

---

## Success Criteria

Phase 6 is successful when:

- ✅ All 4 content types generate successfully
- ✅ Content streams in real-time to frontend
- ✅ Artifacts save to database with correct metadata
- ✅ Validation runs and returns appropriate status
- ✅ No crashes or unhandled errors
- ✅ Performance within expected ranges
- ✅ Context preserved across conversation
- ✅ Two-tier architecture working seamlessly

---

## Next Steps After Testing

Once Phase 6 tests pass:

1. **Phase 7**: Implement artifact management API
   - GET /api/v1/artifacts/:id
   - PUT /api/v1/artifacts/:id (editing)
   - DELETE /api/v1/artifacts/:id

2. **Phase 8**: Add regeneration capability
   - "Regenerate with different tone"
   - "Make it shorter/longer"
   - Version management

3. **Phase 9**: Caching & optimization
   - Cache frequent canon lookups
   - Optimize brief building
   - Reduce token usage

4. **Phase 10**: Advanced validation
   - Plagiarism checking
   - Tone consistency
   - Brand voice matching

---

## Test Results Log

Document your test results here:

```
Test 1 (Email): [ ] Pass [ ] Fail
Test 2 (Ad): [ ] Pass [ ] Fail
Test 3 (Landing Page): [ ] Pass [ ] Fail
Test 4 (Script): [ ] Pass [ ] Fail
Test 5A (Validation Pass): [ ] Pass [ ] Fail
Test 5B (Validation Warning): [ ] Pass [ ] Fail
Test 5C (Validation Fail): [ ] Pass [ ] Fail
Test 6 (Error Handling): [ ] Pass [ ] Fail
Test 7 (Database): [ ] Pass [ ] Fail
Test 8 (Performance): [ ] Pass [ ] Fail
Test 9 (Multi-Content): [ ] Pass [ ] Fail
Test 10 (Frontend): [ ] Pass [ ] Fail

Overall Phase 6 Status: [ ] PASS [ ] FAIL [ ] NEEDS WORK
```

---

## Quick Start Test

**Fastest way to verify Phase 6 works**:

1. Start server: `npm run dev`
2. Open `test-chat.html`
3. Send: "Create a welcome email for new users"
4. Watch for:
   - Canon loading
   - Artifact streaming (word-by-word)
   - Validation results
   - Final email displayed
5. Check database for saved artifact

If all above work → Phase 6 is operational! ✅

