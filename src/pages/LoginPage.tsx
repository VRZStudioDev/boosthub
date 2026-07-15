import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PageLayout } from '../components/layout/PageLayout';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/feedback/ToastProvider';

export default function LoginPage() {
  const { user, signInWithPassword, signInWithMagicLink, signInWithGoogle, resetPasswordForEmail } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingReset, setLoadingReset] = useState(false);
  const [loadingMagicLink, setLoadingMagicLink] = useState(false);

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true });
  }, [user, navigate]);

  function validateEmail(value: string) {
    return /\S+@\S+\.\S+/.test(value);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();

    if (!validateEmail(normalizedEmail)) {
      toast.error('Invalid email address.');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      await signInWithPassword(normalizedEmail, password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not login. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!validateEmail(normalizedEmail)) {
      toast.error('Enter a valid email to reset your password.');
      return;
    }

    setLoadingReset(true);
    try {
      await resetPasswordForEmail(normalizedEmail);
      toast.success('Password reset email sent. Check your inbox.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send reset email. Try again.');
    } finally {
      setLoadingReset(false);
    }
  }

  async function handleMagicLinkFallback() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!validateEmail(normalizedEmail)) {
      toast.error('Enter a valid email before requesting a magic link.');
      return;
    }

    setLoadingMagicLink(true);
    try {
      await signInWithMagicLink(normalizedEmail);
      toast.success('Magic link sent. Check your inbox.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send the magic link. Try again.');
    } finally {
      setLoadingMagicLink(false);
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
              Login with email and password to manage your shortcuts and track your earnings.
            </p>

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
              <Input
                label="Password"
                type="password"
                name="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />

              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleResetPassword}
                  disabled={loadingReset}
                  className="text-sm text-accent-cyan transition hover:underline disabled:opacity-60"
                >
                  {loadingReset ? 'Sending reset email...' : 'Forgot password?'}
                </button>
                <button
                  type="button"
                  onClick={handleMagicLinkFallback}
                  disabled={loadingMagicLink}
                  className="text-xs text-slate-400 transition hover:text-slate-200 hover:underline disabled:opacity-60"
                >
                  {loadingMagicLink ? 'Sending...' : 'Use Magic Link instead'}
                </button>
              </div>

              <Button type="submit" fullWidth size="lg" loading={loading}>
                Login
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
