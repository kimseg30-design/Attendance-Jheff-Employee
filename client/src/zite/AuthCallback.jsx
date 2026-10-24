import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { CheckCircle2, Loader2 } from 'lucide-react';

export default function AuthCallback() {
  const [status, setStatus] = useState('processing'); // 'processing' | 'success' | 'error'
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let finished = false;

    const signalSuccessAndClose = () => {
      if (finished) return;
      finished = true;
      setStatus('success');

      // 1. Notify main window via localStorage broadcast
      try {
        localStorage.setItem('supabase_auth_success', Date.now().toString());
      } catch {}

      // 2. Notify main window via postMessage
      try {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage({ type: 'SUPABASE_OAUTH_SUCCESS' }, '*');
        }
      } catch {}

      // 3. Auto-close this window dialog immediately so the main app window takes over
      setTimeout(() => {
        try {
          window.close();
        } catch {}
      }, 350);

      // Fallback in case window was opened directly instead of as a popup dialog
      setTimeout(() => {
        if (!window.opener && window.history.length <= 1) {
          window.location.assign('/');
        }
      }, 2000);
    };

    // Check URL parameters for OAuth errors
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const err =
      searchParams.get('error_description') ||
      searchParams.get('error') ||
      hashParams.get('error_description') ||
      hashParams.get('error');

    if (err) {
      setStatus('error');
      setErrorMessage(err);
      return;
    }

    // Exchange PKCE code if present
    const code = searchParams.get('code');
    if (code) {
      supabase.auth
        .exchangeCodeForSession(code)
        .then(({ data, error: exErr }) => {
          if (exErr) {
            // Check if session was already set or restored
            supabase.auth.getSession().then(({ data: sess }) => {
              if (sess?.session) {
                signalSuccessAndClose();
              } else {
                setStatus('error');
                setErrorMessage(exErr.message);
              }
            });
          } else if (data?.session) {
            signalSuccessAndClose();
          }
        })
        .catch((e) => {
          setStatus('error');
          setErrorMessage(e.message);
        });
    } else {
      // Check for session in hash or client
      supabase.auth.getSession().then(({ data, error: sessErr }) => {
        if (sessErr) {
          setStatus('error');
          setErrorMessage(sessErr.message);
          return;
        }
        if (data?.session) {
          signalSuccessAndClose();
        }
      }).catch((e) => {
        setStatus('error');
        setErrorMessage(e.message);
      });
    }

    // Listen for auth state change
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        signalSuccessAndClose();
      }
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center bg-background">
      {status === 'error' ? (
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-6 max-w-sm space-y-3">
          <p className="font-semibold text-destructive">Authentication error</p>
          <p className="text-xs text-muted-foreground">{errorMessage}</p>
          <button
            type="button"
            onClick={() => window.close()}
            className="inline-block text-xs text-primary font-medium underline cursor-pointer"
          >
            Close window
          </button>
        </div>
      ) : status === 'success' ? (
        <div className="space-y-3">
          <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
          <p className="text-sm font-semibold text-foreground">Sign-in confirmed!</p>
          <p className="text-xs text-muted-foreground">Closing window dialog and opening app…</p>
        </div>
      ) : (
        <div className="space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm font-medium text-foreground">Completing Google Sign In…</p>
          <p className="text-xs text-muted-foreground">Please wait a moment…</p>
        </div>
      )}
    </div>
  );
}
