/**
 * Script to generate embeddings for resources that don't have them
 * 
 * Usage: npx tsx scripts/generate-embeddings.ts
 */

import { config } from '../src/config/env.js';
import { supabase } from '../src/lib/supabase.js';
import { generateEmbedding } from '../src/lib/openai.js';
import { logger } from '../src/utils/logger.js';

const BUSINESS_PROFILE_ID = 'f1827f56-8547-4be9-8631-15c2cca9bf88';

async function generateEmbeddingsForResources() {
  logger.info('🚀 Starting embedding generation...');

  try {
    // 1. Brand Guidelines
    logger.info('📋 Processing brand guidelines...');
    const { data: brandGuidelines, error: bgError } = await supabase
      .from('brand_guidelines')
      .select('id, search_content')
      .eq('business_profile_id', BUSINESS_PROFILE_ID)
      .is('embedding', null)
      .not('search_content', 'is', null);

    if (bgError) {
      logger.error('❌ Error fetching brand guidelines:', bgError);
    } else if (brandGuidelines && brandGuidelines.length > 0) {
      for (const bg of brandGuidelines) {
        if (!bg.search_content) continue;
        
        logger.info(`  Generating embedding for brand guideline ${bg.id}...`);
        const embedding = await generateEmbedding(bg.search_content);
        
        const { error: updateError } = await supabase
          .from('brand_guidelines')
          .update({
            embedding: embedding, // Supabase handles vector conversion
            semantic_updated_at: new Date().toISOString(),
          })
          .eq('id', bg.id);

        if (updateError) {
          logger.error(`  ❌ Failed to update brand guideline ${bg.id}:`, updateError);
        } else {
          logger.info(`  ✅ Updated brand guideline ${bg.id}`);
        }
      }
    }

    // 2. Offers
    logger.info('💼 Processing offers...');
    const { data: offers, error: offersError } = await supabase
      .from('offers')
      .select('id, search_content')
      .eq('business_profile_id', BUSINESS_PROFILE_ID)
      .is('embedding', null)
      .not('search_content', 'is', null);

    if (offersError) {
      logger.error('❌ Error fetching offers:', offersError);
    } else if (offers && offers.length > 0) {
      for (const offer of offers) {
        if (!offer.search_content) continue;
        
        logger.info(`  Generating embedding for offer ${offer.id}...`);
        const embedding = await generateEmbedding(offer.search_content);
        
        const { error: updateError } = await supabase
          .from('offers')
          .update({
            embedding: embedding, // Supabase handles vector conversion
            semantic_updated_at: new Date().toISOString(),
          })
          .eq('id', offer.id);

        if (updateError) {
          logger.error(`  ❌ Failed to update offer ${offer.id}:`, updateError);
        } else {
          logger.info(`  ✅ Updated offer ${offer.id}`);
        }
      }
    }

    // 3. Testimonials
    logger.info('💬 Processing testimonials...');
    const { data: testimonials, error: testimonialsError } = await supabase
      .from('testimonials')
      .select('id, search_content')
      .eq('business_profile_id', BUSINESS_PROFILE_ID)
      .is('embedding', null)
      .not('search_content', 'is', null);

    if (testimonialsError) {
      logger.error('❌ Error fetching testimonials:', testimonialsError);
    } else if (testimonials && testimonials.length > 0) {
      for (const testimonial of testimonials) {
        if (!testimonial.search_content) continue;
        
        logger.info(`  Generating embedding for testimonial ${testimonial.id}...`);
        const embedding = await generateEmbedding(testimonial.search_content);
        
        const { error: updateError } = await supabase
          .from('testimonials')
          .update({
            embedding: embedding, // Supabase handles vector conversion
          })
          .eq('id', testimonial.id);

        if (updateError) {
          logger.error(`  ❌ Failed to update testimonial ${testimonial.id}:`, updateError);
        } else {
          logger.info(`  ✅ Updated testimonial ${testimonial.id}`);
        }
      }
    }

    logger.info('✨ Embedding generation complete!');
  } catch (error) {
    logger.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
generateEmbeddingsForResources()
  .then(() => {
    logger.info('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('❌ Script failed:', error);
    process.exit(1);
  });
