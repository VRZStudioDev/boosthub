import { PageLayout } from '../components/layout/PageLayout';
import { Button } from '../components/ui/Button';
import { LicenseBadge, UsageBadge } from '../components/ui/Badge';
import { CopyField } from '../components/ui/CopyField';
import { Spinner } from '../components/ui/Spinner';
import { useAuth } from '../context/AuthContext';
import { useProfile } from '../hooks/useProfile';
import { useUsageLogs } from '../hooks/useUsageLogs';
import { useBilling } from '../hooks/useBilling';

// Base URL of your automation worker. Override with VITE_WORKER_BASE_URL.
const WORKER_BASE_URL =
  import.meta.env.VITE_WORKER_BASE_URL ?? 'https://your-worker.workers.dev';

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function LicenseStatusCard() {
  const { data: profile, isLoading } = useProfile();
  const { startCheckout, openCustomerPortal, loadingCheckout, loadingPortal } = useBilling();

  const isActive = profile?.license_status === 'active';

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">License status</h2>
        {isLoading ? (
          <Spinner className="h-5 w-5 text-slate-400" />
        ) : (
          <LicenseBadge status={profile?.license_status ?? 'inactive'} />
        )}
      </div>

      {isActive ? (
        <div className="mt-4">
          <p className="text-sm text-slate-400">
            Your subscription is active.
            {profile?.current_period_end && (
              <>
                {' '}
                Next billing date:{' '}
                <span className="text-slate-200">{formatDate(profile.current_period_end)}</span>.
              </>
            )}
          </p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-4"
            loading={loadingPortal}
            onClick={openCustomerPortal}
          >
            Manage subscription
          </Button>
        </div>
      ) : (
        <div className="mt-4">
          <p className="text-sm text-slate-400">
            Your plan is inactive. Reactivate to keep using voice shortcuts and earnings tracking.
          </p>
          <Button size="sm" className="mt-4" loading={loadingCheckout} onClick={startCheckout}>
            Reactivate Subscription
          </Button>
        </div>
      )}
    </div>
  );
}

function ConfigurationCard() {
  const { user } = useAuth();
  const { data: profile } = useProfile();

  const uniqueId = profile?.telegram_user_id || profile?.id || user?.id || '';
  const shortcutUrl = `${WORKER_BASE_URL}/disparar?usuario=${uniqueId}`;

  const instructions = [
    'Copy your unique ID below.',
    'Install an automation app (e.g. Pushcut) and create a new shortcut.',
    'Set your Siri Shortcut URL to the address below.',
    'Train Siri to say “Trigger 1” to run your shortcut.',
  ];

  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-white">Configuration</h2>
      <p className="mt-1 text-sm text-slate-400">
        Connect your voice shortcut in a couple of minutes.
      </p>

      <ol className="mt-5 space-y-3">
        {instructions.map((text, i) => (
          <li key={text} className="flex gap-3 text-sm text-slate-300">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-accent-cyan/30 bg-navy-950 text-xs font-bold text-accent-cyan">
              {i + 1}
            </span>
            {text}
          </li>
        ))}
      </ol>

      <div className="mt-6 space-y-5">
        <CopyField label="Your unique ID" value={uniqueId} />
        <CopyField label="Siri Shortcut URL" value={shortcutUrl} />
      </div>
    </div>
  );
}

function UsageLogsCard() {
  const { data: logs, isLoading } = useUsageLogs(10);

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Recent activity</h2>
        <span className="text-xs text-slate-500">Last 10 triggers</span>
      </div>

      <div className="mt-4">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner className="h-6 w-6 text-slate-400" />
          </div>
        ) : !logs || logs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 py-10 text-center">
            <p className="text-sm text-slate-400">No activity yet.</p>
            <p className="mt-1 text-xs text-slate-500">
              Your triggers will appear here once you run your shortcut.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-slate-500">
                  <th className="pb-2 font-medium">Date &amp; time</th>
                  <th className="pb-2 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-white/5 last:border-0">
                    <td className="py-3 text-slate-300">{formatDate(log.triggered_at)}</td>
                    <td className="py-3 text-right">
                      <UsageBadge status={log.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <PageLayout>
      <div className="container-page py-10">
        <div className="mb-8">
          <p className="text-sm text-slate-400">Welcome back,</p>
          <h1 className="text-2xl font-bold text-white sm:text-3xl">{user?.email}</h1>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <LicenseStatusCard />
          <div className="lg:row-span-2">
            <ConfigurationCard />
          </div>
          <UsageLogsCard />
        </div>
      </div>
    </PageLayout>
  );
}
