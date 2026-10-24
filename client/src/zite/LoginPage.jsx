import { useState, useEffect, useRef } from 'react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { ShieldCheck, Mail, Lock, AlertCircle, CheckCircle2, ExternalLink, Copy, Check } from 'lucide-react';

export default function LoginPage() {
  const [mode, setMode] = useState('password'); // 'password' | 'magic-link'
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [googleModalOpen, setGoogleModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const popupRef = useRef(null);

  const redirect = new URLSearchParams(window.location.search).get('redirect') || '/';
  const callbackUrl = `${window.location.origin}/auth/callback`;
  const rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL || 'https://xurvumenaszahorrxhxf.supabase.co';
  const supabaseCallbackUrl = `${rawSupabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '')}/auth/v1/callback`;

  // Listen for login completion (initial session, popup message, storage event, or active polling)
  useEffect(() => {
    let active = true;

    const navigateToApp = () => {
      if (!active) return;
      active = false;
      try {
        localStorage.removeItem('supabase_auth_success');
      } catch {}
      window.location.assign(redirect);
    };

    // 1. If already authenticated or restored
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) {
        navigateToApp();
      }
    });

    // 2. Message sent from popup window dialog
    const handleMessage = (event) => {
      if (event.data?.type === 'SUPABASE_OAUTH_SUCCESS') {
        navigateToApp();
      }
    };
    window.addEventListener('message', handleMessage);

    // 3. Storage event fallback (in case browser restricts postMessage from popup)
    const handleStorage = (event) => {
      if (event.key === 'supabase_auth_success') {
        navigateToApp();
      }
    };
    window.addEventListener('storage', handleStorage);

    // 4. Polling while popup window dialog is active
    const interval = setInterval(async () => {
      if (!active) return;
      if (popupRef.current && popupRef.current.closed) {
        setLoading(false);
      }
      const { data } = await supabase.auth.getSession();
      if (data?.session) {
        navigateToApp();
      }
    }, 600);

    return () => {
      active = false;
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('storage', handleStorage);
      clearInterval(interval);
    };
  }, [redirect]);

  const handlePasswordAuth = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!isSupabaseConfigured) {
      setError('Authentication service is currently unavailable. Please check your credentials or network connection.');
      return;
    }

    setLoading(true);

    try {
      if (isSignUp) {
        const { data, error: signUpErr } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: callbackUrl },
        });
        if (signUpErr) throw signUpErr;
        if (data?.session) {
          window.location.assign(redirect);
        } else {
          setMessage('Account created! If email confirmation is enabled, please check your inbox.');
        }
      } else {
        const { data, error: signInErr } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInErr) throw signInErr;
        if (data?.session) {
          window.location.assign(redirect);
        }
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLink = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!isSupabaseConfigured) {
      setError('Authentication service is currently unavailable. Please check your credentials or network connection.');
      return;
    }

    setLoading(true);

    try {
      const { error: otpErr } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: callbackUrl,
          shouldCreateUser: true,
        },
      });
      if (otpErr) throw otpErr;
      setMessage(`Sign-in link sent to ${email}. Please check your inbox.`);
    } catch (err) {
      setError(err.message || 'Could not send sign-in link.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setMessage('');

    if (!isSupabaseConfigured) {
      setError('Authentication service is currently unavailable. Please check your credentials or network connection.');
      return;
    }

    setLoading(true);

    try {
      // 1. Request OAuth authorization URL with skipBrowserRedirect: true to open the window dialog
      const { data, error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: callbackUrl,
          skipBrowserRedirect: true,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (oauthErr) {
        if (
          oauthErr.message?.toLowerCase().includes('not enabled') ||
          oauthErr.message?.toLowerCase().includes('unsupported provider')
        ) {
          setGoogleModalOpen(true);
          setLoading(false);
          return;
        }
        throw oauthErr;
      }

      if (data?.url) {
        // 2. Open centered window dialog
        const width = 500;
        const height = 650;
        const left = window.screenX + Math.max(0, (window.outerWidth - width) / 2);
        const top = window.screenY + Math.max(0, (window.outerHeight - height) / 2);
        const popup = window.open(
          data.url,
          'google_auth_window',
          `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,status=no,resizable=yes`
        );

        if (!popup) {
          setError('Sign-in window dialog was blocked. Please allow popups for this site.');
          setLoading(false);
        } else {
          popupRef.current = popup;
          popup.focus();
        }
      } else {
        setLoading(false);
      }
    } catch (err) {
      setError(err.message || 'Google authentication error. Please try again or use email sign-in.');
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50/50 p-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 sm:p-8 shadow-sm space-y-6">
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-primary/10 text-primary mb-2">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Sahod — PH Payroll</h1>
          <p className="text-sm text-muted-foreground">
            Sign in with your Google Account or Supabase credentials.
          </p>
        </div>

        {/* Primary Google Sign-In Button */}
        <div className="space-y-3">
          <Button
            type="button"
            variant="outline"
            className="w-full flex items-center justify-center gap-2.5 h-11 border-slate-300 hover:bg-slate-50 font-medium text-sm shadow-sm"
            onClick={handleGoogle}
            disabled={loading}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                fill="#EA4335"
              />
            </svg>
            Continue with Google
          </Button>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-3 text-muted-foreground font-medium">
              Or use Email
            </span>
          </div>
        </div>

        {/* Tabs for Auth mode */}
        <div className="flex rounded-lg border bg-muted/50 p-1 text-xs font-medium">
          <button
            type="button"
            className={`flex-1 py-1.5 rounded-md transition-colors ${
              mode === 'password'
                ? 'bg-background shadow-sm text-foreground font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => { setMode('password'); setError(''); setMessage(''); }}
          >
            Email & Password
          </button>
          <button
            type="button"
            className={`flex-1 py-1.5 rounded-md transition-colors ${
              mode === 'magic-link'
                ? 'bg-background shadow-sm text-foreground font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => { setMode('magic-link'); setError(''); setMessage(''); }}
          >
            Magic Link
          </button>
        </div>

        {/* Feedback alerts */}
        {error && (
          <div className="flex items-start gap-2.5 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="flex-1">{error}</div>
          </div>
        )}

        {message && (
          <div className="flex items-start gap-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-800">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
            <div className="flex-1">{message}</div>
          </div>
        )}

        {/* Password Form */}
        {mode === 'password' && (
          <form onSubmit={handlePasswordAuth} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-medium">Email address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  required
                  placeholder="name@company.com"
                  className="pl-9"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-medium">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  required
                  placeholder="••••••••"
                  className="pl-9"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading || !email || !password}>
              {loading ? 'Please wait…' : isSignUp ? 'Create Account' : 'Sign In with Password'}
            </Button>

            <div className="text-center text-xs text-muted-foreground">
              {isSignUp ? (
                <>
                  Already have an account?{' '}
                  <button
                    type="button"
                    className="font-medium text-primary hover:underline"
                    onClick={() => { setIsSignUp(false); setError(''); }}
                  >
                    Sign in
                  </button>
                </>
              ) : (
                <>
                  Don't have an account yet?{' '}
                  <button
                    type="button"
                    className="font-medium text-primary hover:underline"
                    onClick={() => { setIsSignUp(true); setError(''); }}
                  >
                    Sign up
                  </button>
                </>
              )}
            </div>
          </form>
        )}

        {/* Magic Link Form */}
        {mode === 'magic-link' && (
          <form onSubmit={handleMagicLink} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="otp-email" className="text-xs font-medium">Email address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="otp-email"
                  type="email"
                  required
                  placeholder="name@company.com"
                  className="pl-9"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading || !email}>
              {loading ? 'Sending link…' : 'Send Magic Link'}
            </Button>
          </form>
        )}
      </div>

      {/* Google Setup Guide Dialog when not enabled in Supabase */}
      <Dialog open={googleModalOpen} onOpenChange={setGoogleModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enable Google in Supabase</DialogTitle>
            <DialogDescription>
              Google OAuth provider is not yet turned on in your Supabase project. Follow these quick steps:
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs text-slate-700">
            <div className="rounded-lg bg-slate-100 p-3 space-y-1">
              <span className="font-semibold text-slate-900 block">1. Open Supabase Auth Providers</span>
              <a
                href="https://supabase.com/dashboard/project/xurvumenaszahorrxhxf/auth/providers"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
              >
                Go to Supabase Project Providers <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            <div className="rounded-lg bg-slate-100 p-3 space-y-1.5">
              <span className="font-semibold text-slate-900 block">2. Copy Supabase Callback URL</span>
              <p className="text-muted-foreground">Paste this into your Google Cloud Console Authorized redirect URIs:</p>
              <div className="flex items-center gap-1.5">
                <code className="flex-1 bg-white p-1.5 rounded border text-[11px] truncate">
                  {supabaseCallbackUrl}
                </code>
                <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => copyToClipboard(supabaseCallbackUrl)}>
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>

            <div className="rounded-lg bg-slate-100 p-3 space-y-1">
              <span className="font-semibold text-slate-900 block">3. Toggle Google "Enabled"</span>
              <p className="text-muted-foreground">
                In Supabase, toggle Google ON, paste your Google Client ID and Secret, and click Save.
              </p>
            </div>
          </div>

          <DialogFooter className="flex sm:justify-end items-center pt-2">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setGoogleModalOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
