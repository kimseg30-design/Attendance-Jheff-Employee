import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from './supabaseClient';

function toUser(user) {
  if (!user) return null;
  const name = user.user_metadata?.full_name || user.user_metadata?.name || user.email || '';
  const [firstName = '', ...rest] = name.split(' ');
  return {
    id: user.id,
    email: user.email,
    name,
    firstName,
    lastName: rest.join(' '),
    image: user.user_metadata?.avatar_url || null,
    emailVerified: Boolean(user.email_confirmed_at),
    createdAt: new Date(user.created_at || Date.now()),
    updatedAt: new Date(user.updated_at || user.created_at || Date.now()),
  };
}

export function useAuth() {
  const [state, setState] = useState({ user: null, isLoading: true });

  useEffect(() => {
    let active = true;
    for (const key of ['sahod_admin_session', 'sahod_demo_email', 'sahod_simulated_role', 'sahod_last_invited_email']) {
      localStorage.removeItem(key);
    }
    if (!isSupabaseConfigured) {
      setState({ user: null, isLoading: false });
      return () => { active = false; };
    }

    supabase.auth.getSession().then(({ data, error }) => {
      if (active) setState({ user: error ? null : toUser(data?.session?.user), isLoading: false });
    }).catch(() => {
      if (active) setState({ user: null, isLoading: false });
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setState({ user: toUser(session?.user), isLoading: false });
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return state;
}

export function loginWithRedirect({ redirectUrl } = {}) {
  const back = redirectUrl || window.location.pathname + window.location.search;
  window.location.assign(`/login?redirect=${encodeURIComponent(back)}`);
}

export async function logout() {
  if (isSupabaseConfigured) await supabase.auth.signOut();
  window.location.assign('/login');
}

export async function updateProfile(data) {
  if (!isSupabaseConfigured) throw new Error('Authentication is not configured.');
  const { error } = await supabase.auth.updateUser({ data: { full_name: data.name, ...data } });
  if (error) throw error;
}
