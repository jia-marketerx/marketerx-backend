import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Environment schema validation
const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('5000'),
  HOST: z.string().default('0.0.0.0'),

  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // Redis
  REDIS_URL: z.string().url(),
  REDIS_TOKEN: z.string().optional(),

  // AI Providers
  ANTHROPIC_API_KEY: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),
  TAVILY_API_KEY: z.string().min(1),

  // LangSmith (Optional)
  LANGCHAIN_TRACING_V2: z.string().default('false'),
  LANGCHAIN_API_KEY: z.string().optional(),
  LANGCHAIN_PROJECT: z.string().default('marketerx-chat'),

  // Cache TTLs (seconds)
  CACHE_TTL_SESSION: z.string().default('1800'),
  CACHE_TTL_KNOWLEDGE: z.string().default('86400'),
  CACHE_TTL_CANON: z.string().default('604800'),

  // Rate Limiting
  RATE_LIMIT_MAX: z.string().default('100'),
  RATE_LIMIT_WINDOW: z.string().default('60000'),

  // Models
  TIER1_MODEL: z.string().default('claude-3-5-sonnet-20241022'),
  TIER2_MODEL: z.string().default('claude-3-5-haiku-20241022'),
  TIER2_MODEL_ALT: z.string().default('gpt-4o-mini'),
  EMBEDDING_MODEL: z.string().default('text-embedding-3-large'),
});

// Parse and validate environment variables
const parseEnv = () => {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Invalid environment variables:');
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
      process.exit(1);
    }
    throw error;
  }
};

export const env = parseEnv();

// Export typed config object
export const config = {
  server: {
    nodeEnv: env.NODE_ENV,
    port: parseInt(env.PORT, 10),
    host: env.HOST,
    isDevelopment: env.NODE_ENV === 'development',
    isProduction: env.NODE_ENV === 'production',
  },
  supabase: {
    url: env.SUPABASE_URL,
    anonKey: env.SUPABASE_ANON_KEY,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  },
  redis: {
    url: env.REDIS_URL,
    token: env.REDIS_TOKEN,
  },
  ai: {
    anthropic: {
      apiKey: env.ANTHROPIC_API_KEY,
    },
    openai: {
      apiKey: env.OPENAI_API_KEY,
    },
    tavily: {
      apiKey: env.TAVILY_API_KEY,
    },
  },
  langsmith: {
    enabled: env.LANGCHAIN_TRACING_V2 === 'true',
    apiKey: env.LANGCHAIN_API_KEY,
    project: env.LANGCHAIN_PROJECT,
  },
  cache: {
    ttl: {
      session: parseInt(env.CACHE_TTL_SESSION, 10),
      knowledge: parseInt(env.CACHE_TTL_KNOWLEDGE, 10),
      canon: parseInt(env.CACHE_TTL_CANON, 10),
    },
  },
  rateLimit: {
    max: parseInt(env.RATE_LIMIT_MAX, 10),
    window: parseInt(env.RATE_LIMIT_WINDOW, 10),
  },
  models: {
    tier1: env.TIER1_MODEL,
    tier2: env.TIER2_MODEL,
    tier2Alt: env.TIER2_MODEL_ALT,
    embedding: env.EMBEDDING_MODEL,
  },
} as const;

export type Config = typeof config;


