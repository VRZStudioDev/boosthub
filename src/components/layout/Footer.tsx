import { Link } from 'react-router-dom';
import { Logo } from './Logo';

export function Footer() {
  return (
    <footer className="border-t border-white/5 bg-navy-950">
      <div className="container-page flex flex-col items-center justify-between gap-4 py-8 sm:flex-row">
        <Logo />
        <p className="text-center text-sm text-slate-500 sm:text-left">
          © {new Date().getFullYear()} BoostHub. Work smarter, not harder.
        </p>
        <div className="flex gap-5 text-sm text-slate-400">
          <Link to="/login" className="transition hover:text-white">
            Log in
          </Link>
          <Link to="/signup" className="transition hover:text-white">
            Sign up
          </Link>
        </div>
      </div>
    </footer>
  );
}
