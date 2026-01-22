/**
 * Diagnostic script to investigate embedding search issues
 * 
 * Usage: npx tsx scripts/diagnose-offer-embeddings.ts [query]
 */

import { supabase } from '../src/lib/supabase.js';
import { generateEmbedding } from '../src/lib/openai.js';
import { logger } from '../src/utils/logger.js';

async function diagnoseEmbeddings(query: string = 'offer') {
  logger.info(`🔬 Diagnosing embedding search for query: "${query}"`);
  logger.info('');

  try {
    // Generate embedding
    logger.info('⚙️  Generating query embedding...');
    const embedding = await generateEmbedding(query);
    logger.info(`✅ Embedding generated (${embedding.length} dimensions)`);
    logger.info('');

    // Test with different thresholds
    const thresholds = [0.0, 0.05, 0.1, 0.15, 0.2];
    
    logger.info('📊 Testing with different similarity thresholds:');
    logger.info('');

    for (const threshold of thresholds) {
      const { data, error } = await supabase.rpc('match_offers', {
        query_embedding: embedding,
        match_threshold: threshold,
        match_count: 50, // Get more results for analysis
        filter_business_profile_id: null,
      });

      if (error) {
        logger.error(`   Threshold ${threshold}: Error - ${error.message}`);
        continue;
      }

      const count = data?.length || 0;
      if (count > 0) {
        const similarities = data.map((r: any) => r.similarity);
        const minSim = Math.min(...similarities);
        const maxSim = Math.max(...similarities);
        const avgSim = similarities.reduce((a: number, b: number) => a + b, 0) / similarities.length;

        logger.info(`   Threshold ${threshold}: ${count} results`);
        logger.info(`      Similarity range: ${(minSim * 100).toFixed(2)}% - ${(maxSim * 100).toFixed(2)}%`);
        logger.info(`      Average similarity: ${(avgSim * 100).toFixed(2)}%`);
        
        // Show top 3
        if (count > 0) {
          logger.info(`      Top results:`);
          data.slice(0, 3).forEach((r: any, i: number) => {
            logger.info(`        ${i + 1}. ${r.name} (${(r.similarity * 100).toFixed(2)}%)`);
          });
        }
      } else {
        logger.info(`   Threshold ${threshold}: 0 results`);
      }
      logger.info('');
    }

    // Check embedding update dates
    logger.info('📅 Checking embedding update dates:');
    const { data: dateData, error: dateError } = await supabase
      .from('offers')
      .select('id, name, semantic_updated_at')
      .not('embedding', 'is', null)
      .eq('status', 'active')
      .order('semantic_updated_at', { ascending: false })
      .limit(10);

    if (!dateError && dateData) {
      logger.info(`   Recent updates:`);
      dateData.forEach((offer: any) => {
        const daysAgo = Math.floor(
          (Date.now() - new Date(offer.semantic_updated_at).getTime()) / (1000 * 60 * 60 * 24)
        );
        logger.info(`      ${offer.name}: ${daysAgo} days ago`);
      });
    }

    logger.info('');
    logger.info('✨ Diagnosis complete!');

  } catch (error) {
    logger.error('❌ Diagnostic error:', error);
    throw error;
  }
}

const query = process.argv[2] || 'offer';

diagnoseEmbeddings(query)
  .then(() => {
    logger.info('✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('❌ Script failed:', error);
    process.exit(1);
  });
