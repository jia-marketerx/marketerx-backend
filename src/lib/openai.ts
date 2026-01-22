import OpenAI from 'openai';
import { config } from '../config/env.js';

/**
 * OpenAI client for GPT models and embeddings
 */
export const openai = new OpenAI({
  apiKey: config.ai.openai.apiKey,
});

/**
 * Test OpenAI connection
 */
export async function testOpenAIConnection(): Promise<boolean> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Hello' }],
    });
    return response.choices.length > 0;
  } catch (error) {
    console.error('❌ OpenAI connection failed:', error);
    return false;
  }
}

/**
 * Generate embeddings for semantic search
 * Note: Database expects 1536 dimensions, so we specify dimensions for text-embedding-3-large
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: config.models.embedding,
    input: text,
    dimensions: 1536, // Force 1536 dimensions to match database schema
  });
  return response.data[0].embedding;
}

