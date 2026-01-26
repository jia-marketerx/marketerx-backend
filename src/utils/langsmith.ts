import { Client, RunTree } from 'langsmith';
import { traceable } from 'langsmith/traceable';
import { config } from '../config/env.js';
import { logger } from './logger.js';

/**
 * LangSmith client for tracing and logging
 */
export const langsmithClient = config.langsmith.enabled && config.langsmith.apiKey
  ? new Client({
      apiKey: config.langsmith.apiKey,
    })
  : null;

/**
 * Metadata for LangSmith traces
 */
export interface TraceMetadata {
  conversationId?: string;
  userId?: string;
  businessProfileId?: string;
  messageId?: string;
  tier?: 'tier1' | 'tier2';
  contentType?: string;
  toolName?: string;
  iteration?: number;
  stream?: boolean;
  [key: string]: any;
}

/**
 * Trace an LLM call (Anthropic/OpenAI)
 */
export function traceLLMCall<T extends (...args: any[]) => any>(
  fn: T,
  options: {
    name: string;
    metadata?: TraceMetadata;
    extractTokens?: (result: any) => { input: number; output: number };
    extractModel?: (result: any) => string;
  }
): T {
  if (!config.langsmith.enabled) {
    return fn; // Return original function if tracing disabled
  }

  return traceable(fn, {
    name: options.name,
    run_type: 'llm',
    metadata: options.metadata,
    project_name: config.langsmith.project,
  }) as T;
}

/**
 * Trace a tool execution
 */
export function traceToolCall<T extends (...args: any[]) => any>(
  fn: T,
  options: {
    name: string;
    metadata?: TraceMetadata;
  }
): T {
  if (!config.langsmith.enabled) {
    return fn;
  }

  return traceable(fn, {
    name: options.name,
    run_type: 'tool',
    metadata: options.metadata,
    project_name: config.langsmith.project,
  }) as T;
}

/**
 * Trace an agent orchestration run
 */
export function traceAgentRun<T extends (...args: any[]) => any>(
  fn: T,
  options: {
    name: string;
    metadata?: TraceMetadata;
  }
): T {
  if (!config.langsmith.enabled) {
    return fn;
  }

  return traceable(fn, {
    name: options.name,
    run_type: 'chain',
    metadata: options.metadata,
    project_name: config.langsmith.project,
  }) as T;
}

/**
 * Create a manual trace span (for custom tracing)
 */
export async function createTraceSpan<T>(
  name: string,
  fn: () => Promise<T>,
  options: {
    runType?: 'llm' | 'chain' | 'tool' | 'retriever';
    metadata?: TraceMetadata;
    inputs?: any;
  } = {}
): Promise<T> {
  if (!config.langsmith.enabled || !langsmithClient) {
    return fn();
  }

  const runTree = new RunTree({
    name,
    run_type: options.runType || 'chain',
    project_name: config.langsmith.project,
    inputs: options.inputs || {},
    extra: {
      metadata: options.metadata || {},
    },
    client: langsmithClient,
  });

  try {
    await runTree.postRun();
    const result = await fn();
    await runTree.end({ outputs: result });
    return result;
  } catch (error) {
    await runTree.end({ error: error instanceof Error ? error.message : 'Unknown error' });
    throw error;
  }
}

/**
 * Log trace completion to custom logger
 */
export function logTraceCompletion(
  traceName: string,
  metadata: {
    traceId?: string;
    duration?: number;
    tokens?: { input: number; output: number };
    status: 'success' | 'error';
    error?: string;
  }
) {
  const logData = {
    trace: traceName,
    ...metadata,
  };

  if (metadata.status === 'error') {
    logger.error('LangSmith trace failed', logData);
  } else {
    logger.info('LangSmith trace completed', logData);
  }
}

/**
 * Helper to extract metadata from agent state
 */
export function extractAgentMetadata(state: any): TraceMetadata {
  return {
    conversationId: state.conversationId,
    userId: state.userId,
    businessProfileId: state.businessProfileId,
    messageId: state.messages?.[0]?.id,
  };
}
