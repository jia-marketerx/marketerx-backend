import OpenAI from 'openai';
import { config } from '../config/env.js';

/**
 * OpenAI client for GPT models and embeddings
 */
export const openai = new OpenAI({
  apiKey: config.api.openai,
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
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: config.models.embedding,
    input: text,
  });
  return response.data[0].embedding;
}

