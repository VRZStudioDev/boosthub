import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PageLayout } from '../components/layout/PageLayout';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/feedback/ToastProvider';

export default function LoginPage() {
  const { user, signInWithMagicLink, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true });
  }, [user, navigate]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      await signInWithMagicLink(email.trim());
      setSent(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send the magic link. Try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    try {
      await signInWithGoogle();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Google sign-in failed. Try again.');
    }
  }

  return (
    <PageLayout withFooter={false}>
      <div className="container-page flex min-h-[calc(100dvh-4rem)] items-center justify-center py-12">
        <div className="w-full max-w-md">
          <div className="card">
            <h1 className="text-2xl font-bold text-white">Welcome back</h1>
            <p className="mt-2 text-sm text-slate-400">
              Log in to manage your shortcuts and track your earnings.
            </p>

            {sent ? (
              <div className="mt-8 rounded-xl border border-accent-green/30 bg-accent-green/10 p-5 text-center">
                <svg className="mx-auto h-10 w-10 text-accent-green" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
                <p className="mt-3 font-semibold text-white">Check your email to log in.</p>
                <p className="mt-1 text-sm text-slate-400">
                  We sent a magic link to <span className="text-accent-cyan">{email}</span>.
                </p>
                <button
                  type="button"
                  onClick={() => setSent(false)}
                  className="mt-4 text-sm text-slate-400 underline transition hover:text-white"
                >
                  Use a different email
                </button>
              </div>
            ) : (
              <>
                <form onSubmit={handleSubmit} className="mt-8 space-y-4">
                  <Input
                    label="Email address"
                    type="email"
                    name="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  <Button type="submit" fullWidth size="lg" loading={loading}>
                    Send Magic Link
                  </Button>
                </form>

                <div className="my-6 flex items-center gap-3">
                  <span className="h-px flex-1 bg-white/10" />
                  <span className="text-xs text-slate-500">or</span>
                  <span className="h-px flex-1 bg-white/10" />
                </div>

                <Button variant="secondary" fullWidth onClick={handleGoogle}>
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0012 23z" />
                    <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 010-4.2V7.06H2.18a11 11 0 000 9.88l3.66-2.84z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 002.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z" />
                  </svg>
                  Continue with Google
                </Button>
              </>
            )}
          </div>

          <p className="mt-6 text-center text-sm text-slate-400">
            Don&apos;t have an account?{' '}
            <Link to="/signup" className="font-semibold text-accent-cyan hover:underline">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </PageLayout>
  );
}
