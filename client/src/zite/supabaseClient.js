import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://xurvumenaszahorrxhxf.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_0uYtc2gANKbcM2trdrO8zA_DINcfSiZ';

function normalizeSupabaseUrl(url) {
  if (!url) return '';
  try {
    return new URL(url).origin;
  } catch {
    return String(url).replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
  }
}

function cleanConfigValue(val, fallback) {
  if (!val) return fallback;
  const str = String(val).trim();
  if (
    str === '' ||
    str.includes('your-project') ||
    str.includes('placeholder') ||
    str.includes('example')
  ) {
    return fallback;
  }
  return str;
}

const rawUrl = normalizeSupabaseUrl(cleanConfigValue(import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL, DEFAULT_SUPABASE_URL));
const rawKey = cleanConfigValue(import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.SUPABASE_PUBLISHABLE_KEY, DEFAULT_SUPABASE_ANON_KEY);

function isValidSupabaseConfig(url, key) {
  if (!url || !key) return false;
  const str = String(url).trim().toLowerCase();
  if (
    str === '' ||
    str.includes('placeholder') ||
    str.includes('your-project') ||
    str.includes('example') ||
    !str.startsWith('http')
  ) {
    return false;
  }
  return true;
}

export const isSupabaseConfigured = isValidSupabaseConfig(rawUrl, rawKey);

export const supabase = isSupabaseConfigured
  ? createClient(rawUrl, rawKey)
  : {
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        signOut: async () => {},
        signInWithPassword: async () => { throw new Error('Supabase not configured'); },
        signInWithOtp: async () => { throw new Error('Supabase not configured'); },
        signInWithOAuth: async () => { throw new Error('Supabase not configured'); },
        updateUser: async () => {},
      },
      from: () => ({
        select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }), limit: async () => ({ data: [], error: null }) }) }),
      }),
      storage: {
        from: () => ({
          upload: async () => ({ error: new Error('Supabase Storage not configured') }),
          getPublicUrl: () => ({ data: { publicUrl: '' } }),
        }),
      },
    };

