import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Spinner } from '../components/ui/Spinner';

/**
 * Landing target for auth redirects (OAuth, recovery flows). Supabase parses
 * session updates from the URL automatically (detectSessionInUrl: true), so
 * we just wait for auth state and route onward.
 */
export default function AuthCallbackPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    navigate(user ? '/dashboard' : '/login', { replace: true });
  }, [user, loading, navigate]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4">
      <Spinner className="h-8 w-8 text-accent-cyan" />
      <p className="text-sm text-slate-400">Finalizing authentication…</p>
    </div>
  );
}
