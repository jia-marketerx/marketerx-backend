/**
 * Script to test embedding search on offers table
 * 
 * Usage: npx tsx scripts/test-offer-search.ts [query]
 * Example: npx tsx scripts/test-offer-search.ts "SaaS software"
 */

import { supabase } from '../src/lib/supabase.js';
import { generateEmbedding } from '../src/lib/openai.js';
import { logger } from '../src/utils/logger.js';

const BUSINESS_PROFILE_ID = 'f1827f56-8547-4be9-8631-15c2cca9bf88';

interface SearchResult {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  search_content: string | null;
  similarity: number;
}

async function testOfferSearch(query: string, topK: number = 5, threshold: number = 0) {
  logger.info(`🔍 Testing offer search with query: "${query}"`);
  logger.info(`📊 Parameters: topK=${topK}, threshold=${threshold}`);
  logger.info('');

  try {
    // Generate embedding for the query
    logger.info('⚙️  Generating embedding for query...');
    const embedding = await generateEmbedding(query);
    logger.info(`✅ Embedding generated (dimensions: ${embedding.length})`);
    logger.info('');

    // Search offers using the RPC function
    logger.info('🔎 Searching offers...');
    const { data, error } = await supabase.rpc('match_offers', {
      query_embedding: embedding,
      match_threshold: threshold,
      match_count: topK,
      filter_business_profile_id: BUSINESS_PROFILE_ID,
    });

    if (error) {
      logger.error('❌ Error searching offers:', error);
      return;
    }

    if (!data || data.length === 0) {
      logger.warn('⚠️  No offers found matching the query');
      return;
    }

    // Display results
    logger.info(`✅ Found ${data.length} matching offer(s):`);
    logger.info('');

    data.forEach((result: SearchResult, index: number) => {
      logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      logger.info(`📦 Result ${index + 1}:`);
      logger.info(`   ID: ${result.id}`);
      logger.info(`   Name: ${result.name}`);
      logger.info(`   Similarity: ${(result.similarity * 100).toFixed(2)}%`);
      
      if (result.price !== null) {
        logger.info(`   Price: $${result.price}`);
      }
      
      if (result.description) {
        logger.info(`   Description: ${result.description.substring(0, 100)}${result.description.length > 100 ? '...' : ''}`);
      }
      
      if (result.search_content) {
        logger.info(`   Search Content: ${result.search_content.substring(0, 150)}${result.search_content.length > 150 ? '...' : ''}`);
      }
      
      logger.info('');
    });

    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.info('✨ Search completed successfully!');

  } catch (error) {
    logger.error('❌ Fatal error during search:', error);
    throw error;
  }
}

// Get query from command line arguments or use default
const query = process.argv[2] || 'SaaS software';

// Get optional parameters
const topK = process.argv[3] ? parseInt(process.argv[3], 10) : 5;
const threshold = process.argv[4] ? parseFloat(process.argv[4]) : 0;

// Run the test
testOfferSearch(query, topK, threshold)
  .then(() => {
    logger.info('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('❌ Script failed:', error);
    process.exit(1);
  });
