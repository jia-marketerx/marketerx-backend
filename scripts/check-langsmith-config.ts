/**
 * LangSmith Configuration Diagnostic Script
 * 
 * Run this to verify your LangSmith setup in any environment
 */

import { config } from '../src/config/env.js';
import { langsmithClient } from '../src/utils/langsmith.js';

console.log('🔍 LangSmith Configuration Check\n');
console.log('================================\n');

// Check 1: Environment Variables
console.log('1️⃣ Environment Variables:');
console.log(`   NODE_ENV: ${config.server.nodeEnv}`);
console.log(`   LANGCHAIN_TRACING_V2: ${process.env.LANGCHAIN_TRACING_V2}`);
console.log(`   LANGCHAIN_API_KEY: ${process.env.LANGCHAIN_API_KEY ? '✅ SET (length: ' + process.env.LANGCHAIN_API_KEY.length + ')' : '❌ NOT SET'}`);
console.log(`   LANGCHAIN_PROJECT: ${process.env.LANGCHAIN_PROJECT || '❌ NOT SET'}`);
console.log();

// Check 2: Parsed Config
console.log('2️⃣ Parsed Config:');
console.log(`   langsmith.enabled: ${config.langsmith.enabled}`);
console.log(`   langsmith.apiKey: ${config.langsmith.apiKey ? '✅ SET' : '❌ NOT SET'}`);
console.log(`   langsmith.project: ${config.langsmith.project}`);
console.log();

// Check 3: Client Status
console.log('3️⃣ Client Status:');
console.log(`   langsmithClient: ${langsmithClient ? '✅ INITIALIZED' : '❌ NULL'}`);
console.log();

// Check 4: Diagnostics
console.log('4️⃣ Diagnostics:');

if (!config.langsmith.enabled) {
  console.log('   ⚠️  WARNING: LangSmith is DISABLED');
  console.log('   → LANGCHAIN_TRACING_V2 is not set to "true"');
  console.log('   → Current value: "' + process.env.LANGCHAIN_TRACING_V2 + '"');
  console.log('   → Fix: Set LANGCHAIN_TRACING_V2=true in your .env file');
} else {
  console.log('   ✅ LangSmith is enabled');
}

if (!config.langsmith.apiKey) {
  console.log('   ⚠️  WARNING: API key is MISSING');
  console.log('   → Fix: Set LANGCHAIN_API_KEY in your .env file');
  console.log('   → Get key from: https://smith.langchain.com/settings');
} else {
  console.log('   ✅ API key is set');
  
  // Validate key format
  if (!config.langsmith.apiKey.startsWith('lsv2_')) {
    console.log('   ⚠️  WARNING: API key format looks incorrect');
    console.log('   → LangSmith v2 keys should start with "lsv2_"');
  } else {
    console.log('   ✅ API key format looks correct');
  }
}

if (!langsmithClient) {
  console.log('   ❌ CRITICAL: LangSmith client is NULL');
  console.log('   → No traces will be sent to LangSmith');
  console.log('   → Tracing functions will return original functions unwrapped');
} else {
  console.log('   ✅ LangSmith client is initialized');
  console.log('   → Traces should be sent to LangSmith');
}

console.log();

// Final verdict
console.log('5️⃣ Final Verdict:');
if (langsmithClient) {
  console.log('   ✅ ✅ ✅ LangSmith is CONFIGURED CORRECTLY');
  console.log(`   → Traces will be sent to project: "${config.langsmith.project}"`);
  console.log('   → Check dashboard: https://smith.langchain.com/');
} else {
  console.log('   ❌ ❌ ❌ LangSmith is NOT WORKING');
  console.log('   → Fix the issues above and try again');
}

console.log();
console.log('================================\n');
