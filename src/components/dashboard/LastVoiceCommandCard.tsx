import { Spinner } from '../ui/Spinner';
import { UsageBadge } from '../ui/Badge';
import { useLastVoiceCommand } from '../../hooks/useLastVoiceCommand';

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function formatUsd(amount: number | null) {
  if (amount == null || !Number.isFinite(amount)) return '--';
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function LastVoiceCommandCard({ className = '' }: { className?: string }) {
  const { data, isLoading, isError } = useLastVoiceCommand();

  return (
    <div className={`card ${className}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Last Voice Command</h2>
        <span className="text-xs text-slate-500">Voice feedback</span>
      </div>

      <div className="mt-4">
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Spinner className="h-6 w-6 text-slate-400" />
          </div>
        ) : isError ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
            Could not load your latest voice command.
          </div>
        ) : !data ? (
          <div className="rounded-xl border border-dashed border-white/10 py-8 text-center">
            <p className="text-sm text-slate-300">
              No voice commands yet. Say 'Hey Siri, BoostHub' to try it.
            </p>
          </div>
        ) : (
          <div className="space-y-3 rounded-xl border border-white/10 bg-navy-950/60 p-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-400">Decision</p>
              <UsageBadge status={data.decision} />
            </div>

            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-400">Amount</p>
              <p className="text-sm font-semibold text-white">{formatUsd(data.amount)}</p>
            </div>

            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-400">Time</p>
              <p className="text-sm text-slate-200">{formatDate(data.happenedAt)}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}