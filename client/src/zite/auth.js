// Sign-in via Supabase Auth (Email/Password, Magic Link, Google) with Admin quick-login.
import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from './supabaseClient';

const MOCK_USER = {
  id: 'usr_admin',
  email: 'kimsegarra4@gmail.com',
  name: 'Kim Segarra',
  firstName: 'Kim',
  lastName: 'Segarra',
  image: null,
  emailVerified: true,
  createdAt: new Date('2023-01-01'),
  updatedAt: new Date(),
};

function toUser(u) {
  if (!u) return null;
  const meta = u.user_metadata || {};
  const name = meta.full_name || meta.name || u.email;
  const [firstName, ...rest] = String(name).split(' ');
  return {
    id: u.id,
    email: u.email,
    name,
    firstName,
    lastName: rest.join(' '),
    image: meta.avatar_url || null,
    emailVerified: !!u.email_confirmed_at,
    createdAt: new Date(u.created_at || Date.now()),
    updatedAt: new Date(u.updated_at || u.created_at || Date.now()),
  };
}

export function useAuth() {
  const [state, setState] = useState(() => {
    const adminSession = typeof window !== 'undefined' ? localStorage.getItem('sahod_admin_session') : null;
    if (adminSession === 'true') {
      return { user: MOCK_USER, isLoading: false };
    }
    return { user: null, isLoading: true };
  });

  useEffect(() => {
    let active = true;
    const adminSession = typeof window !== 'undefined' ? localStorage.getItem('sahod_admin_session') : null;

    if (isSupabaseConfigured) {
      supabase.auth.getSession().then(({ data, error }) => {
        if (!active) return;
        if (!error && data?.session?.user) {
          setState({ user: toUser(data.session.user), isLoading: false });
        } else if (adminSession === 'true') {
          setState({ user: MOCK_USER, isLoading: false });
        } else {
          setState({ user: null, isLoading: false });
        }
      }).catch(() => {
        if (!active) return;
        setState({ user: adminSession === 'true' ? MOCK_USER : null, isLoading: false });
      });

      const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
        if (!active) return;
        if (session?.user) {
          if (typeof window !== 'undefined') localStorage.removeItem('sahod_admin_session');
          setState({ user: toUser(session.user), isLoading: false });
        } else {
          const isAdm = typeof window !== 'undefined' && localStorage.getItem('sahod_admin_session') === 'true';
          setState({ user: isAdm ? MOCK_USER : null, isLoading: false });
        }
      });

      return () => {
        active = false;
        sub.subscription.unsubscribe();
      };
    } else {
      // Supabase not configured: default to Admin
      setState({ user: adminSession === 'false' ? null : MOCK_USER, isLoading: false });
    }
  }, []);

  return state;
}

export function loginWithRedirect({ redirectUrl } = {}) {
  const back = redirectUrl || window.location.pathname + window.location.search;
  window.location.assign(`/login?redirect=${encodeURIComponent(back)}`);
}

export async function logout() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('sahod_admin_session');
    localStorage.setItem('sahod_logged_out', 'true');
  }
  try {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
  } catch {}
  window.location.assign('/login');
}

export function loginAsAdmin() {
  if (typeof window !== 'undefined') {
    localStorage.setItem('sahod_admin_session', 'true');
    localStorage.removeItem('sahod_logged_out');
  }
  const redirect = new URLSearchParams(window.location.search).get('redirect') || '/';
  window.location.assign(redirect);
}

export async function updateProfile(data) {
  if (isSupabaseConfigured) {
    await supabase.auth.updateUser({ data: { full_name: data.name, ...data } });
  }
}
