import { PageLayout } from '../components/layout/PageLayout';
import { Button } from '../components/ui/Button';
import { LicenseBadge, UsageBadge } from '../components/ui/Badge';
import { Spinner } from '../components/ui/Spinner';
import { EarningsCalculator } from '../components/dashboard/EarningsCalculator';
import { DecisionsStats } from '../components/dashboard/DecisionsStats';
import { LastVoiceCommandCard } from '../components/dashboard/LastVoiceCommandCard';
import { LastVoiceAssistantCard } from '../components/dashboard/LastVoiceAssistantCard';
import { useAuth } from '../context/AuthContext';
import { useProfile } from '../hooks/useProfile';
import { useUsageLogs } from '../hooks/useUsageLogs';
import { useBilling } from '../hooks/useBilling';
import { MONTHLY_PRICE_LABEL } from '../lib/stripe';

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
            Your {MONTHLY_PRICE_LABEL}/month subscription is active.
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
            Your {MONTHLY_PRICE_LABEL}/month plan is inactive. Reactivate to keep using earnings
            tracking and voice automation.
          </p>
          <Button size="sm" className="mt-4" loading={loadingCheckout} onClick={startCheckout}>
            Reactivate {MONTHLY_PRICE_LABEL}/month Plan
          </Button>
        </div>
      )}
    </div>
  );
}

function UsageLogsCard() {
  const { data: logs, isLoading } = useUsageLogs(10);

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Recent activity</h2>
        <span className="text-xs text-slate-500">Last 10 events</span>
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
              Your recent BoostHub activity will appear here.
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
          <EarningsCalculator />
          <DecisionsStats className="lg:col-start-2" />
          <LastVoiceCommandCard className="lg:col-start-2" />
          <LastVoiceAssistantCard />
          <UsageLogsCard />
        </div>
      </div>
    </PageLayout>
  );
}
