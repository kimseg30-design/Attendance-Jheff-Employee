import { createClient } from '@supabase/supabase-js';

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

function normalizeSupabaseUrl(url) {
  if (!url) return '';
  try {
    return new URL(url).origin;
  } catch {
    return String(url).replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
  }
}

const DEFAULT_URL = 'https://xurvumenaszahorrxhxf.supabase.co';
const DEFAULT_KEY = 'sb_publishable_0uYtc2gANKbcM2trdrO8zA_DINcfSiZ';

const rawUrl = normalizeSupabaseUrl(cleanConfigValue(import.meta.env.VITE_SUPABASE_URL, DEFAULT_URL));
const rawKey = cleanConfigValue(import.meta.env.VITE_SUPABASE_ANON_KEY, DEFAULT_KEY);

function isValidSupabaseConfig(url, key) {
  try {
    return Boolean(url && key && new URL(url).protocol === 'https:');
  } catch {
    return false;
  }
}

export const isSupabaseConfigured = isValidSupabaseConfig(rawUrl, rawKey);
export const supabase = isSupabaseConfigured
  ? createClient(rawUrl, rawKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : {
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
        signOut: async () => {},
        signInWithPassword: async () => ({ error: new Error('Authentication is not configured.') }),
        signInWithOtp: async () => ({ error: new Error('Authentication is not configured.') }),
        signInWithOAuth: async () => ({ error: new Error('Authentication is not configured.') }),
        updateUser: async () => ({ error: new Error('Authentication is not configured.') }),
      },
      storage: {
        from: () => ({
          upload: async () => ({ error: new Error('Storage is not configured.') }),
          getPublicUrl: () => ({ data: { publicUrl: '' } }),
        }),
      },
    };