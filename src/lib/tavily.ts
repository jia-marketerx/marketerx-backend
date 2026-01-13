/**
 * Tavily Client Setup
 * Web search optimized for AI agents
 */

import { tavily as tavilyClient } from '@tavily/core';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

export const tavily = tavilyClient({ apiKey: config.api.tavily });

/**
 * Test Tavily connection
 */
export async function testTavilyConnection(): Promise<boolean> {
  try {
    const response = await tavily.search('test', { max_results: 1 });
    return response && response.results !== undefined;
  } catch (error) {
    logger.error('❌ Tavily connection failed:', error);
    return false;
  }
}

