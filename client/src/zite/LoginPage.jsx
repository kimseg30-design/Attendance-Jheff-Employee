import { useState } from 'react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { LockKeyhole, Mail, ShieldCheck } from 'lucide-react';

export default function LoginPage() {
  const params = new URLSearchParams(window.location.search);
  const redirect = params.get('redirect') || '/';
  const [email, setEmail] = useState(params.get('email') || '');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const authenticate = async (action) => {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      if (!isSupabaseConfigured) throw new Error('Authentication is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
      await action();
    } catch (err) {
      setError(err.message || 'Could not sign in.');
    } finally {
      setLoading(false);
    }
  };

  const signIn = (event) => {
    event.preventDefault();
    authenticate(async () => {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (authError) throw authError;
      if (data?.session) window.location.assign(redirect);
    });
  };

  const sendMagicLink = () => authenticate(async () => {
    const { error: authError } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirect)}`, shouldCreateUser: false } });
    if (authError) throw authError;
    setMessage(`Sign-in link sent to ${email}.`);
  });

  const signInWithGoogle = () => authenticate(async () => {
    const { error: authError } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirect)}` } });
    if (authError) throw authError;
  });

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <section className="w-full max-w-md space-y-6 rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
        <header className="space-y-2 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground"><ShieldCheck className="h-6 w-6" /></div>
          <h1 className="text-2xl font-bold">Sign in to Sahod</h1>
          <p className="text-sm text-muted-foreground">Use your approved Supabase account to continue.</p>
        </header>

        {!isSupabaseConfigured && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">Authentication is not configured. Contact your administrator.</p>}
        {error && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">{error}</p>}
        {message && <p role="status" className="rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm">{message}</p>}

        <form onSubmit={signIn} className="space-y-4">
          <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="password">Password</Label><Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></div>
          <Button className="w-full" type="submit" disabled={loading || !isSupabaseConfigured}><LockKeyhole className="mr-2 h-4 w-4" />Sign in</Button>
        </form>

        <div className="grid gap-2 sm:grid-cols-2">
          <Button variant="outline" type="button" disabled={loading || !isSupabaseConfigured || !email.trim()} onClick={sendMagicLink}><Mail className="mr-2 h-4 w-4" />Email link</Button>
          <Button variant="outline" type="button" disabled={loading || !isSupabaseConfigured} onClick={signInWithGoogle}>Continue with Google</Button>
        </div>
      </section>
    </main>
  );
}
