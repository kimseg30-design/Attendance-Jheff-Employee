import { createClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.VITE_SUPABASE_URL || '';
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

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
