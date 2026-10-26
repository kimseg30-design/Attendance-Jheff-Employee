// Sign-in via Supabase Auth (Email/Password, Magic Link, Google) with Admin quick-login.
import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from './supabaseClient';

const DEFAULT_ADMIN_EMAIL = 'kimsegarra410@gmail.com';

const MOCK_USER = {
  id: 'usr_admin',
  email: DEFAULT_ADMIN_EMAIL,
  name: 'Kim Segarra',
  firstName: 'Kim',
  lastName: 'Segarra',
  image: null,
  emailVerified: true,
  createdAt: new Date('2023-01-01'),
  updatedAt: new Date(),
};

function getActiveMockUser() {
  let email = DEFAULT_ADMIN_EMAIL;
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('sahod_demo_email');
    if (stored && (stored.endsWith('@example.com') || stored.includes('dummy'))) {
      localStorage.removeItem('sahod_demo_email');
    } else if (stored) {
      email = stored;
    }
  }
  let id = 'usr_admin';
  let name = 'Kim Segarra';
  if (email === 'kimsegarra4@gmail.com') {
    id = 'usr_admin_alt';
    name = 'Kim Segarra (4)';
  } else if (email === 'kimsegarra516@gmail.com') {
    id = 'usr_admin_orig';
    name = 'Kim Segarra (Orig)';
  } else if (email !== DEFAULT_ADMIN_EMAIL) {
    id = `usr_${email.replace(/[^a-zA-Z0-9]/g, '_')}`;
    name = email.split('@')[0];
  }
  return {
    ...MOCK_USER,
    id,
    email,
    name,
    firstName: name.split(' ')[0],
  };
}

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
      return { user: getActiveMockUser(), isLoading: false };
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
          setState({ user: getActiveMockUser(), isLoading: false });
        } else {
          setState({ user: null, isLoading: false });
        }
      }).catch(() => {
        if (!active) return;
        setState({ user: adminSession === 'true' ? getActiveMockUser() : null, isLoading: false });
      });

      const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
        if (!active) return;
        if (session?.user) {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('sahod_admin_session');
            localStorage.removeItem('sahod_demo_email');
          }
          setState({ user: toUser(session.user), isLoading: false });
        } else {
          const isAdm = typeof window !== 'undefined' && localStorage.getItem('sahod_admin_session') === 'true';
          setState({ user: isAdm ? getActiveMockUser() : null, isLoading: false });
        }
      });

      return () => {
        active = false;
        sub.subscription.unsubscribe();
      };
    } else {
      // Supabase not configured: default to Admin
      setState({ user: adminSession === 'false' ? null : getActiveMockUser(), isLoading: false });
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
    localStorage.removeItem('sahod_demo_email');
    localStorage.setItem('sahod_logged_out', 'true');
  }
  try {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
  } catch {}
  window.location.assign('/login');
}

export function loginAsUser(userEmail, redirectPath) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('sahod_admin_session', 'true');
    localStorage.setItem('sahod_demo_email', userEmail.trim().toLowerCase());
    localStorage.removeItem('sahod_logged_out');
    localStorage.removeItem('sahod_simulated_role');
  }
  const redirect = redirectPath || new URLSearchParams(window.location.search).get('redirect') || '/';
  window.location.assign(redirect);
}

export function loginAsAdmin(adminEmail = 'kimsegarra4@gmail.com') {
  loginAsUser(adminEmail);
}

export async function updateProfile(data) {
  if (isSupabaseConfigured) {
    await supabase.auth.updateUser({ data: { full_name: data.name, ...data } });
  }
}
