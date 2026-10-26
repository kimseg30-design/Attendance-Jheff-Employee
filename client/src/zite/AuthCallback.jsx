import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { Loader2 } from 'lucide-react';

export default function AuthCallback() {
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(window.location.search);
    const requestedRedirect = params.get('redirect') || '/';
    const redirect = requestedRedirect.startsWith('/') && !requestedRedirect.startsWith('//') ? requestedRedirect : '/';

    async function completeSignIn() {
      if (!isSupabaseConfigured) throw new Error('Authentication is not configured.');
      const authError = params.get('error_description') || params.get('error');
      if (authError) throw new Error(authError);
      const code = params.get('code');
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) throw exchangeError;
      }
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!data?.session) throw new Error('No signed-in session was returned. Please sign in again.');
      window.location.replace(redirect);
    }

    completeSignIn().catch((err) => { if (active) setError(err.message || 'Sign in could not be completed.'); });
    return () => { active = false; };
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      {error
        ? <div role="alert" className="max-w-md rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center"><h1 className="font-semibold">Authentication error</h1><p className="mt-2 text-sm text-muted-foreground">{error}</p><a className="mt-4 inline-block text-sm underline" href="/login">Return to sign in</a></div>
        : <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Completing sign in…</div>}
    </main>
  );
}
