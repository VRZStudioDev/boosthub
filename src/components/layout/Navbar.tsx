import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../feedback/ToastProvider';
import { Button, ButtonLink } from '../ui/Button';
import { Logo } from './Logo';

export function Navbar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [open, setOpen] = useState(false);

  async function handleSignOut() {
    try {
      await signOut();
      toast.success('Signed out');
      navigate('/');
    } catch {
      toast.error('Could not sign out. Try again.');
    }
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `text-sm font-medium transition ${isActive ? 'text-white' : 'text-slate-400 hover:text-white'}`;

  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-navy-950/80 backdrop-blur">
      <nav className="container-page flex h-16 items-center justify-between">
        <Logo />

        <div className="hidden items-center gap-6 md:flex">
          {user ? (
            <>
              <NavLink to="/dashboard" className={linkClass}>
                Dashboard
              </NavLink>
              <NavLink to="/settings" className={linkClass}>
                Settings
              </NavLink>
              <Button variant="secondary" size="sm" onClick={handleSignOut}>
                Log out
              </Button>
            </>
          ) : (
            <>
              <Link to="/#features" className="text-sm font-medium text-slate-400 transition hover:text-white">
                Features
              </Link>
              <Link to="/#pricing" className="text-sm font-medium text-slate-400 transition hover:text-white">
                Pricing
              </Link>
              <ButtonLink to="/login" variant="ghost" size="sm">
                Log in
              </ButtonLink>
              <ButtonLink to="/signup" size="sm">
                Get started
              </ButtonLink>
            </>
          )}
        </div>

        <button
          type="button"
          className="text-slate-300 md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
          aria-expanded={open}
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d={open ? 'M6 18L18 6M6 6l12 12' : 'M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5'}
            />
          </svg>
        </button>
      </nav>

      {open && (
        <div className="border-t border-white/5 bg-navy-900/95 px-5 py-4 md:hidden">
          <div className="flex flex-col gap-3">
            {user ? (
              <>
                <Link to="/dashboard" onClick={() => setOpen(false)} className="py-1 text-slate-200">
                  Dashboard
                </Link>
                <Link to="/settings" onClick={() => setOpen(false)} className="py-1 text-slate-200">
                  Settings
                </Link>
                <Button variant="secondary" size="sm" onClick={handleSignOut} fullWidth>
                  Log out
                </Button>
              </>
            ) : (
              <>
                <Link to="/#features" onClick={() => setOpen(false)} className="py-1 text-slate-200">
                  Features
                </Link>
                <Link to="/#pricing" onClick={() => setOpen(false)} className="py-1 text-slate-200">
                  Pricing
                </Link>
                <ButtonLink to="/login" variant="secondary" size="sm" fullWidth onClick={() => setOpen(false)}>
                  Log in
                </ButtonLink>
                <ButtonLink to="/signup" size="sm" fullWidth onClick={() => setOpen(false)}>
                  Get started
                </ButtonLink>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
