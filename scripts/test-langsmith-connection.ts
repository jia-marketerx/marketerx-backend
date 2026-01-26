/**
 * Test LangSmith Connection
 * 
 * This script sends a test trace to LangSmith to verify the connection works
 */

import { config } from '../src/config/env.js';
import { langsmithClient, createTraceSpan } from '../src/utils/langsmith.js';
import { logger } from '../src/utils/logger.js';

async function testLangSmithConnection() {
  console.log('🧪 Testing LangSmith Connection...\n');

  // Step 1: Check config
  console.log('Step 1: Checking Configuration');
  console.log(`  Enabled: ${config.langsmith.enabled}`);
  console.log(`  API Key: ${config.langsmith.apiKey ? '✅ SET' : '❌ NOT SET'}`);
  console.log(`  Project: ${config.langsmith.project}`);
  console.log(`  Client: ${langsmithClient ? '✅ INITIALIZED' : '❌ NULL'}`);
  console.log();

  if (!config.langsmith.enabled) {
    console.error('❌ FAILED: LangSmith is not enabled');
    console.error('   Set LANGCHAIN_TRACING_V2=true in your .env file');
    process.exit(1);
  }

  if (!langsmithClient) {
    console.error('❌ FAILED: LangSmith client is null');
    console.error('   Check your LANGCHAIN_API_KEY');
    process.exit(1);
  }

  // Step 2: Send test trace
  console.log('Step 2: Sending Test Trace...');
  
  try {
    const result = await createTraceSpan(
      'test-langsmith-connection',
      async () => {
        // Simulate some work
        await new Promise(resolve => setTimeout(resolve, 100));
        
        return {
          message: 'Test trace sent successfully',
          timestamp: new Date().toISOString(),
          environment: config.server.nodeEnv,
        };
      },
      {
        runType: 'chain',
        metadata: {
          test: true,
          environment: config.server.nodeEnv,
          script: 'test-langsmith-connection',
        },
        inputs: {
          test: 'Testing LangSmith connection',
        },
      }
    );

    console.log('  ✅ Trace sent successfully!');
    console.log('  Result:', result);
    console.log();

    // Step 3: Instructions
    console.log('Step 3: Verify on Dashboard');
    console.log('  1. Go to: https://smith.langchain.com/');
    console.log(`  2. Select project: "${config.langsmith.project}"`);
    console.log('  3. Look for trace: "test-langsmith-connection"');
    console.log('  4. It should appear within 5-10 seconds');
    console.log();

    console.log('✅ ✅ ✅ TEST PASSED');
    console.log('LangSmith is configured correctly and traces are being sent!');
    console.log();

  } catch (error) {
    console.error('❌ FAILED: Error sending trace');
    console.error('Error:', error);
    console.log();
    console.log('Possible issues:');
    console.log('  1. Invalid API key');
    console.log('  2. Network/firewall blocking access to api.smith.langchain.com');
    console.log('  3. Project name does not exist');
    console.log();
    process.exit(1);
  }
}

// Run test
testLangSmithConnection().catch((error) => {
  logger.error('Test failed with error:', error);
  process.exit(1);
});
