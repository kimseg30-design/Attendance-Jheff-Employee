import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { Loader2 } from 'lucide-react';

export default function AuthCallback() {
  const [error, setError] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data, error: sessionErr }) => {
      if (sessionErr) {
        setError(sessionErr.message);
        return;
      }
      if (data?.session) {
        if (window.opener) {
          window.opener.postMessage({ type: 'SUPABASE_OAUTH_SUCCESS' }, '*');
          setTimeout(() => {
            window.close();
          }, 400);
        } else {
          window.location.assign('/');
        }
      } else {
        // If hash hasn't been exchanged yet, listen for auth change
        const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
          if (session) {
            if (window.opener) {
              window.opener.postMessage({ type: 'SUPABASE_OAUTH_SUCCESS' }, '*');
              setTimeout(() => {
                window.close();
              }, 400);
            } else {
              window.location.assign('/');
            }
          }
        });
        return () => sub.subscription.unsubscribe();
      }
    }).catch((e) => setError(e.message));
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center bg-background">
      {error ? (
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-6 max-w-sm space-y-3">
          <p className="font-semibold text-destructive">Authentication error</p>
          <p className="text-xs text-muted-foreground">{error}</p>
          <a href="/login" className="inline-block text-xs text-primary font-medium underline">
            Return to login
          </a>
        </div>
      ) : (
        <div className="space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm font-medium">Completing Google Sign In…</p>
          <p className="text-xs text-muted-foreground">This window will close automatically.</p>
        </div>
      )}
    </div>
  );
}
