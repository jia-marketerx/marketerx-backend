import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config/env.js';

/**
 * Anthropic client for Claude API
 */
export const anthropic = new Anthropic({
  apiKey: config.ai.anthropic.apiKey,
});

/**
 * Test Anthropic connection
 */
export async function testAnthropicConnection(): Promise<boolean> {
  try {
    const response = await anthropic.messages.create({
      model: config.models.tier1,
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Hello' }],
    });
    return response.content.length > 0;
  } catch (error) {
    console.error('❌ Anthropic connection failed:', error);
    return false;
  }
}

