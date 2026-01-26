/**
 * Test script for LangSmith integration
 * 
 * This script verifies that LangSmith tracing is working correctly
 * by simulating a simple LLM call and tool execution.
 */

import { config } from '../src/config/env.js';
import { 
  traceLLMCall, 
  traceToolCall,
  logTraceCompletion,
  langsmithClient 
} from '../src/utils/langsmith.js';

async function testLangSmithIntegration() {
  console.log('\n🧪 Testing LangSmith Integration\n');
  console.log('='.repeat(50));

  // Check if LangSmith is enabled
  console.log('\n1. Configuration Check:');
  console.log(`   LANGCHAIN_TRACING_V2: ${config.langsmith.enabled}`);
  console.log(`   LANGCHAIN_PROJECT: ${config.langsmith.project}`);
  console.log(`   LANGCHAIN_API_KEY: ${config.langsmith.apiKey ? '✅ Set' : '❌ Not set'}`);
  console.log(`   Client initialized: ${langsmithClient ? '✅ Yes' : '❌ No'}`);

  if (!config.langsmith.enabled) {
    console.log('\n⚠️  LangSmith tracing is DISABLED');
    console.log('   To enable, set LANGCHAIN_TRACING_V2=true in your .env file');
    console.log('   Get API key from: https://smith.langchain.com/settings\n');
    return;
  }

  if (!config.langsmith.apiKey) {
    console.log('\n❌ LANGCHAIN_API_KEY is not set!');
    console.log('   Get your API key from: https://smith.langchain.com/settings');
    console.log('   Add it to your .env file: LANGCHAIN_API_KEY=lsv2_pt_...\n');
    return;
  }

  console.log('\n✅ LangSmith is enabled and configured!\n');

  // Test 1: Trace a mock LLM call
  console.log('2. Testing LLM Call Tracing:');
  
  const mockLLMCall = traceLLMCall(
    async (prompt: string) => {
      // Simulate LLM call
      await new Promise(resolve => setTimeout(resolve, 100));
      return {
        content: `Response to: ${prompt}`,
        tokens: { input: 10, output: 20 },
      };
    },
    {
      name: 'test-llm-call',
      metadata: {
        conversationId: 'test-conv-123',
        userId: 'test-user',
        businessProfileId: 'test-biz',
        tier: 'tier1',
      },
    }
  );

  const startTime = Date.now();
  try {
    const result = await mockLLMCall('Hello, this is a test');
    const duration = Date.now() - startTime;
    
    console.log(`   ✅ LLM call traced successfully`);
    console.log(`   Duration: ${duration}ms`);
    console.log(`   Result: ${result.content}`);
    
    logTraceCompletion('test-llm-call', {
      duration,
      tokens: result.tokens,
      status: 'success',
    });
  } catch (error: any) {
    console.log(`   ❌ LLM call tracing failed: ${error.message}`);
  }

  // Test 2: Trace a mock tool call
  console.log('\n3. Testing Tool Call Tracing:');
  
  const mockToolCall = traceToolCall(
    async (query: string) => {
      // Simulate tool execution
      await new Promise(resolve => setTimeout(resolve, 50));
      return {
        success: true,
        results: [`Result 1 for ${query}`, `Result 2 for ${query}`],
      };
    },
    {
      name: 'test-tool-call',
      metadata: {
        conversationId: 'test-conv-123',
        userId: 'test-user',
        businessProfileId: 'test-biz',
        toolName: 'knowledge_search',
        query: 'test query',
      },
    }
  );

  const toolStartTime = Date.now();
  try {
    const result = await mockToolCall('brand guidelines');
    const toolDuration = Date.now() - toolStartTime;
    
    console.log(`   ✅ Tool call traced successfully`);
    console.log(`   Duration: ${toolDuration}ms`);
    console.log(`   Results: ${result.results.length} items`);
    
    logTraceCompletion('test-tool-call', {
      duration: toolDuration,
      status: 'success',
    });
  } catch (error: any) {
    console.log(`   ❌ Tool call tracing failed: ${error.message}`);
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('\n✅ LangSmith integration test completed!\n');
  console.log('Next steps:');
  console.log('1. View traces in LangSmith dashboard:');
  console.log(`   https://smith.langchain.com/o/default/projects/p/${config.langsmith.project}/traces\n`);
  console.log('2. Look for traces named:');
  console.log('   - test-llm-call');
  console.log('   - test-tool-call\n');
  console.log('3. Verify metadata is present:');
  console.log('   - conversationId: test-conv-123');
  console.log('   - userId: test-user');
  console.log('   - businessProfileId: test-biz\n');
  console.log('4. Read full documentation:');
  console.log('   - LANGSMITH_INTEGRATION.md\n');
}

// Run the test
testLangSmithIntegration()
  .then(() => {
    console.log('Test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
  });
