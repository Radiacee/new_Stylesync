import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Use ONLY NEXT_PUBLIC_ prefixed env vars so server & client get identical build-time values.
// Avoid mixing with unexposed SUPABASE_URL vars that would cause SSR/CSR divergence and hydration issues.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export function assertSupabase() {
  if (!supabase) throw new Error('Supabase not configured');
  return supabase;
}
