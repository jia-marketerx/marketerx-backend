import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config/env.js';

/**
 * Anthropic client for Claude API
 */
export const anthropic = new Anthropic({
  apiKey: config.api.anthropic,
});

/**
 * Test Anthropic connection
 */
export async function testAnthropicConnection(): Promise<boolean> {
  try {
    // Try the configured model first
    const response = await anthropic.messages.create({
      model: config.models.tier1,
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Hello' }],
    });
    return response.content.length > 0;
  } catch (error: any) {
    // If model not found, try fallback models
    if (error?.status === 404) {
      console.warn('⚠️ Configured model not found, trying fallback models...');
      const fallbackModels = [
        'claude-sonnet-4-20250514',
        'claude-opus-4-20251124',
        'claude-3-5-sonnet-20241022',
        'claude-3-opus-20240229',
        'claude-3-sonnet-20240229'
      ];
      
      for (const model of fallbackModels) {
        try {
          const response = await anthropic.messages.create({
            model,
            max_tokens: 10,
            messages: [{ role: 'user', content: 'Hello' }],
          });
          console.log(`✅ Anthropic connected using fallback model: ${model}`);
          return response.content.length > 0;
        } catch (fallbackError) {
          // Continue to next fallback
          continue;
        }
      }
    }
    
    console.error('❌ Anthropic connection failed:', error);
    return false;
  }
}

