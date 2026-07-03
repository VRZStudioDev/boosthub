import type { ReactNode } from 'react';
import { Navbar } from './Navbar';
import { Footer } from './Footer';

/** Shared page shell with the top nav and footer. */
export function PageLayout({ children, withFooter = true }: { children: ReactNode; withFooter?: boolean }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar />
      <main className="flex-1">{children}</main>
      {withFooter && <Footer />}
    </div>
  );
}
