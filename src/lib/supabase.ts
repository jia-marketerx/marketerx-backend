import { createClient } from '@supabase/supabase-js';
import { config } from '../config/env.js';

/**
 * Supabase client for database operations
 * Uses service role key for backend operations
 */
export const supabase = createClient(
  config.supabase.url,
  config.supabase.serviceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

/**
 * Test database connection
 */
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    const { error } = await supabase.from('profiles').select('id').limit(1);
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
}


