import { PageLayout } from '../components/layout/PageLayout';
import { ButtonLink } from '../components/ui/Button';

export default function NotFoundPage() {
  return (
    <PageLayout>
      <div className="container-page flex min-h-[60vh] flex-col items-center justify-center text-center">
        <p className="text-7xl font-extrabold gradient-text">404</p>
        <h1 className="mt-4 text-2xl font-bold text-white">Page not found</h1>
        <p className="mt-2 max-w-sm text-slate-400">
          The page you&apos;re looking for doesn&apos;t exist or has moved.
        </p>
        <ButtonLink to="/" className="mt-8">
          Back to home
        </ButtonLink>
      </div>
    </PageLayout>
  );
}
