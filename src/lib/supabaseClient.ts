import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Surface misconfiguration early in dev instead of a cryptic runtime error.
  // eslint-disable-next-line no-console
  console.error(
    'Missing Supabase env vars. Copy .env.example to .env and fill VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.',
  );
}

export const supabase = createClient<Database>(supabaseUrl ?? '', supabaseAnonKey ?? '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const SITE_URL =
  import.meta.env.VITE_SITE_URL ??
  (typeof window !== 'undefined' ? window.location.origin : '');
