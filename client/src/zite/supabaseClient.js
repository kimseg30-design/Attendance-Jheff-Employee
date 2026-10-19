import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://xurvumenaszahorrxhxf.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_0uYtc2gANKbcM2trdrO8zA_DINcfSiZ';

const rawUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.SUPABASE_URL ||
  DEFAULT_SUPABASE_URL;

const rawKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.SUPABASE_PUBLISHABLE_KEY ||
  DEFAULT_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  rawUrl &&
  rawKey &&
  rawUrl.trim() !== '' &&
  !rawUrl.includes('placeholder')
);

const url = isSupabaseConfigured ? rawUrl : DEFAULT_SUPABASE_URL;
const key = isSupabaseConfigured ? rawKey : DEFAULT_SUPABASE_ANON_KEY;

export const supabase = createClient(url, key);
