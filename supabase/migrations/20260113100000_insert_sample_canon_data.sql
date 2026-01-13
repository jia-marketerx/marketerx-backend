-- =====================================================
-- SAMPLE CANON DATA
-- Purpose: Insert example canon items for testing and demonstration
-- Note: This assumes business_profiles table exists with at least one profile
-- =====================================================

-- =====================================================
-- SAMPLE CANON ITEMS
-- =====================================================

-- For demonstration, we'll create canon items that reference a placeholder business_profile_id
-- In production, these should be inserted via the API with actual business_profile_id values

-- Helper comment: Replace 'YOUR_BUSINESS_PROFILE_ID' with an actual UUID when testing

-- =====================================================
-- 1. EMAIL TEMPLATES
-- =====================================================

-- Example: Welcome Email Template
DO $$
DECLARE
    v_template_category_id uuid;
BEGIN
    -- Get the template category ID
    SELECT id INTO v_template_category_id 
    FROM public.canon_categories 
    WHERE name = 'template';

    -- Note: This is a sample insert that will fail without a valid business_profile_id
    -- Uncomment and use actual business_profile_id for testing
    
    /*
    INSERT INTO public.canon_items (
        business_profile_id,
        category_id,
        title,
        slug,
        description,
        content_type,
        content,
        tags,
        priority
    ) VALUES (
        'YOUR_BUSINESS_PROFILE_ID'::uuid,
        v_template_category_id,
        'Welcome Email Template',
        'email-welcome-template',
        'Standard welcome email template with personalization placeholders',
        'email',
        jsonb_build_object(
            'structure', jsonb_build_array(
                jsonb_build_object('section', 'subject', 'guidelines', 'Personalized, warm, 5-7 words'),
                jsonb_build_object('section', 'preheader', 'guidelines', 'Complement subject, 40-100 chars'),
                jsonb_build_object('section', 'greeting', 'guidelines', 'Use first name if available'),
                jsonb_build_object('section', 'introduction', 'guidelines', 'Thank them, set expectations'),
                jsonb_build_object('section', 'value_proposition', 'guidelines', 'What they''ll gain'),
                jsonb_build_object('section', 'cta', 'guidelines', 'Clear single action'),
                jsonb_build_object('section', 'footer', 'guidelines', 'Support contact, unsubscribe')
            ),
            'placeholders', jsonb_build_object(
                '{{firstName}}', 'User''s first name',
                '{{companyName}}', 'Your company name',
                '{{productName}}', 'Your product/service name',
                '{{ctaLink}}', 'Primary call-to-action URL'
            ),
            'example', 'Subject: Welcome to {{companyName}}, {{firstName}}!

Hi {{firstName}},

Welcome to {{productName}}! We''re thrilled to have you on board.

Over the next few days, we''ll help you get started with personalized tips and resources. Here''s what you can expect:
- Day 1: Getting started guide
- Day 3: Advanced tips and tricks
- Day 7: Exclusive insider resources

Ready to dive in?
[Get Started] → {{ctaLink}}

Questions? Reply to this email anytime.

Best,
The {{companyName}} Team'
        ),
        ARRAY['email', 'welcome', 'onboarding', 'template'],
        100
    );
    */
END $$;

-- =====================================================
-- 2. COPYWRITING FRAMEWORKS
-- =====================================================

DO $$
DECLARE
    v_framework_category_id uuid;
BEGIN
    SELECT id INTO v_framework_category_id 
    FROM public.canon_categories 
    WHERE name = 'framework';

    /*
    -- AIDA Framework
    INSERT INTO public.canon_items (
        business_profile_id,
        category_id,
        title,
        slug,
        description,
        content_type,
        content,
        tags,
        priority
    ) VALUES (
        'YOUR_BUSINESS_PROFILE_ID'::uuid,
        v_framework_category_id,
        'AIDA Copywriting Framework',
        'framework-aida',
        'Classic marketing framework: Attention, Interest, Desire, Action',
        'universal',
        jsonb_build_object(
            'name', 'AIDA',
            'fullName', 'Attention, Interest, Desire, Action',
            'description', 'A proven copywriting formula for persuasive content',
            'steps', jsonb_build_array(
                jsonb_build_object(
                    'step', 'Attention',
                    'purpose', 'Grab the reader''s attention immediately',
                    'tactics', jsonb_build_array('Bold headline', 'Provocative question', 'Surprising statistic', 'Compelling image')
                ),
                jsonb_build_object(
                    'step', 'Interest',
                    'purpose', 'Build interest by connecting to their needs',
                    'tactics', jsonb_build_array('Address pain points', 'Present relevant information', 'Show empathy', 'Use storytelling')
                ),
                jsonb_build_object(
                    'step', 'Desire',
                    'purpose', 'Create desire by showing benefits and value',
                    'tactics', jsonb_build_array('Highlight benefits over features', 'Use social proof', 'Paint a picture of success', 'Create urgency')
                ),
                jsonb_build_object(
                    'step', 'Action',
                    'purpose', 'Prompt clear, specific action',
                    'tactics', jsonb_build_array('Clear CTA', 'Remove friction', 'Offer guarantee', 'Make it easy')
                )
            ),
            'bestFor', jsonb_build_array('Sales pages', 'Email campaigns', 'Ads', 'Landing pages'),
            'keywords', jsonb_build_array('AIDA', 'attention', 'interest', 'desire', 'action', 'conversion')
        ),
        ARRAY['framework', 'aida', 'copywriting', 'universal'],
        95
    );

    -- PAS Framework
    INSERT INTO public.canon_items (
        business_profile_id,
        category_id,
        title,
        slug,
        description,
        content_type,
        content,
        tags,
        priority
    ) VALUES (
        'YOUR_BUSINESS_PROFILE_ID'::uuid,
        v_framework_category_id,
        'PAS Copywriting Framework',
        'framework-pas',
        'Problem-Agitate-Solution framework for compelling copy',
        'universal',
        jsonb_build_object(
            'name', 'PAS',
            'fullName', 'Problem, Agitate, Solution',
            'description', 'Connect with pain points and present your solution',
            'steps', jsonb_build_array(
                jsonb_build_object(
                    'step', 'Problem',
                    'purpose', 'Identify the problem your audience faces',
                    'tactics', jsonb_build_array('Be specific', 'Use their language', 'Show you understand')
                ),
                jsonb_build_object(
                    'step', 'Agitate',
                    'purpose', 'Amplify the pain of the problem',
                    'tactics', jsonb_build_array('Show consequences', 'Use emotional triggers', 'Create urgency')
                ),
                jsonb_build_object(
                    'step', 'Solution',
                    'purpose', 'Present your product/service as the solution',
                    'tactics', jsonb_build_array('Show transformation', 'Provide proof', 'Make offer clear')
                )
            ),
            'bestFor', jsonb_build_array('B2B copy', 'Problem-solving products', 'Service marketing'),
            'keywords', jsonb_build_array('PAS', 'problem', 'agitate', 'solution', 'pain points')
        ),
        ARRAY['framework', 'pas', 'copywriting', 'universal'],
        90
    );
    */
END $$;

-- =====================================================
-- 3. COMPLIANCE RULES
-- =====================================================

DO $$
DECLARE
    v_compliance_category_id uuid;
BEGIN
    SELECT id INTO v_compliance_category_id 
    FROM public.canon_categories 
    WHERE name = 'compliance';

    /*
    -- Email Compliance Rules
    INSERT INTO public.canon_items (
        business_profile_id,
        category_id,
        title,
        slug,
        description,
        content_type,
        content,
        tags,
        priority
    ) VALUES (
        'YOUR_BUSINESS_PROFILE_ID'::uuid,
        v_compliance_category_id,
        'Email Marketing Compliance Rules',
        'compliance-email-marketing',
        'CAN-SPAM, GDPR, and general email compliance requirements',
        'email',
        jsonb_build_object(
            'regulations', jsonb_build_array('CAN-SPAM', 'GDPR', 'CASL'),
            'requirements', jsonb_build_object(
                'required', jsonb_build_array(
                    'Physical mailing address in footer',
                    'Clear unsubscribe link (visible, functional)',
                    'Accurate "From" and "Subject" lines',
                    'Honor opt-outs within 10 business days',
                    'Identify message as an ad (if promotional)'
                ),
                'prohibited', jsonb_build_array(
                    'False or misleading header information',
                    'Deceptive subject lines',
                    'Purchased email lists (without consent)',
                    'Sending after unsubscribe request'
                ),
                'bestPractices', jsonb_build_array(
                    'Double opt-in for new subscribers',
                    'Clear privacy policy link',
                    'Preference center for email frequency',
                    'Easy-to-read unsubscribe instructions',
                    'Keep records of consent'
                )
            ),
            'penalties', 'CAN-SPAM violations: up to $46,517 per email',
            'lastUpdated', '2024-01-01'
        ),
        ARRAY['compliance', 'email', 'legal', 'can-spam', 'gdpr'],
        100
    );

    -- Brand Voice Guidelines
    INSERT INTO public.canon_items (
        business_profile_id,
        category_id,
        title,
        slug,
        description,
        content_type,
        content,
        tags,
        priority
    ) VALUES (
        'YOUR_BUSINESS_PROFILE_ID'::uuid,
        v_compliance_category_id,
        'Brand Voice Guidelines',
        'compliance-brand-voice',
        'Tone, style, and language guidelines for consistent brand communication',
        'universal',
        jsonb_build_object(
            'toneAttributes', jsonb_build_array('Professional', 'Friendly', 'Confident', 'Helpful'),
            'voice', jsonb_build_object(
                'personality', 'Expert friend who empowers without overwhelming',
                'perspective', 'We speak to equals, not down to customers',
                'vocabulary', 'Clear, jargon-free, accessible language'
            ),
            'do', jsonb_build_array(
                'Use active voice',
                'Be concise and clear',
                'Use contractions (we''re, you''ll)',
                'Address reader directly (you, your)',
                'Use bullet points for clarity'
            ),
            'avoid', jsonb_build_array(
                'Jargon without explanation',
                'Passive voice',
                'Overly formal language',
                'All caps (except acronyms)',
                'Excessive exclamation marks'
            ),
            'examples', jsonb_build_object(
                'good', jsonb_build_array(
                    'You''ll love how easy this is.',
                    'Here''s what we recommend...',
                    'Let''s get started.'
                ),
                'bad', jsonb_build_array(
                    'One will find the utilization quite satisfactory.',
                    'It is recommended by our organization...',
                    'The commencement of operations shall proceed.'
                )
            )
        ),
        ARRAY['compliance', 'brand', 'voice', 'style', 'universal'],
        95
    );
    */
END $$;

-- =====================================================
-- 4. STYLE PREFERENCES
-- =====================================================

DO $$
DECLARE
    v_style_category_id uuid;
BEGIN
    SELECT id INTO v_style_category_id 
    FROM public.canon_categories 
    WHERE name = 'style';

    /*
    INSERT INTO public.canon_items (
        business_profile_id,
        category_id,
        title,
        slug,
        description,
        content_type,
        content,
        tags,
        priority
    ) VALUES (
        'YOUR_BUSINESS_PROFILE_ID'::uuid,
        v_style_category_id,
        'Email Formatting Style Guide',
        'style-email-formatting',
        'Formatting preferences for email content',
        'email',
        jsonb_build_object(
            'formatting', jsonb_build_object(
                'paragraphs', 'Keep to 2-3 sentences max',
                'lineSpacing', 'Add blank line between paragraphs',
                'emphasis', 'Use bold for key points, italics sparingly',
                'lists', 'Use bullets for 3+ items'
            ),
            'structure', jsonb_build_object(
                'greeting', 'Hi [Name], or Hello [Name],',
                'closing', 'Best, or Cheers, or Thanks,',
                'signature', 'Name + Title + Company'
            ),
            'links', jsonb_build_object(
                'display', 'Use descriptive anchor text, not raw URLs',
                'buttons', 'Primary CTA as button, secondary as text link'
            ),
            'length', jsonb_build_object(
                'subject', '5-7 words, 40-50 characters',
                'preheader', '40-100 characters',
                'body', '150-300 words for promotional, up to 500 for educational'
            )
        ),
        ARRAY['style', 'email', 'formatting', 'structure'],
        85
    );
    */
END $$;

-- =====================================================
-- NOTES FOR IMPLEMENTATION
-- =====================================================

/*
To use this sample data:

1. First, create a business_profile in your Supabase database
2. Get the business_profile_id (UUID)
3. Replace 'YOUR_BUSINESS_PROFILE_ID' with the actual UUID
4. Uncomment the INSERT statements
5. Run this migration

Or better yet, use the API endpoints to create canon items programmatically,
which will automatically handle business_profile_id and generate embeddings.

The sample data covers:
- Email templates (welcome email structure)
- Copywriting frameworks (AIDA, PAS)
- Compliance rules (email marketing, brand voice)
- Style preferences (email formatting)

These examples demonstrate:
- Different content_type values (email, universal)
- JSONB structure flexibility
- Tags for categorization
- Priority for loading order
- Rich, structured content that agents can use
*/

COMMENT ON COLUMN public.canon_items.content IS 'Flexible JSONB structure - see sample data for examples of templates, frameworks, compliance rules, and style guides';

