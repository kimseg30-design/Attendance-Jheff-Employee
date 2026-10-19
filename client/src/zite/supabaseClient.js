import { createClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL;
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(
  rawUrl &&
  rawKey &&
  rawUrl.trim() !== '' &&
  !rawUrl.includes('placeholder')
);

const url = isSupabaseConfigured ? rawUrl : 'https://placeholder.supabase.co';
const key = isSupabaseConfigured ? rawKey : 'placeholder-anon-key';

export const supabase = createClient(url, key);
