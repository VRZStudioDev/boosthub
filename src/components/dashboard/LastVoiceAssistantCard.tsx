import { Spinner } from '../ui/Spinner';
import { useLastVoiceAssistant } from '../../hooks/useLastVoiceAssistant';

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

function formatPerMile(value: number | null) {
  if (value == null || !Number.isFinite(value)) return '--';
  return `$${value.toFixed(2)}/mi`;
}

const statusStyles = {
  success: 'border-accent-green/40 bg-accent-green/10 text-accent-green',
  failed: 'border-red-500/40 bg-red-500/10 text-red-300',
} as const;

const decisionStyles = {
  accept: 'text-accent-green',
  decline: 'text-amber-300',
  marginal: 'text-accent-cyan',
  error: 'text-red-300',
} as const;

export function LastVoiceAssistantCard({ className = '' }: { className?: string }) {
  const { data, isLoading, isError } = useLastVoiceAssistant();

  return (
    <div className={`card ${className}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Last Voice Assistant</h2>
        <span className="text-xs text-slate-500">Analyze Order</span>
      </div>

      <div className="mt-4">
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Spinner className="h-6 w-6 text-slate-400" />
          </div>
        ) : isError ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
            Could not load your latest voice assistant result.
          </div>
        ) : !data ? (
          <div className="rounded-xl border border-dashed border-white/10 py-8 text-center">
            <p className="text-sm text-slate-300">
              No voice assistant analysis yet. Run the Siri shortcut to see your latest result.
            </p>
          </div>
        ) : (
          <div className="space-y-3 rounded-xl border border-white/10 bg-navy-950/60 p-4">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-slate-400">Status</p>
              <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${statusStyles[data.status]}`}>
                {data.status}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-slate-400">Decision</p>
              <p className={`text-sm font-semibold capitalize ${decisionStyles[data.decision]}`}>
                {data.decision}
              </p>
            </div>
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-slate-400">Net payout</p>
              <p className="text-sm font-semibold text-white">{formatUsd(data.net_payout)}</p>
            </div>
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-slate-400">Per mile</p>
              <p className="text-sm font-semibold text-white">{formatPerMile(data.per_mile)}</p>
            </div>
            <div>
              <p className="text-sm text-slate-400">Message</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-200">
                {data.status === 'failed' ? data.error_message : data.reason}
              </p>
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-white/10 pt-3">
              <p className="text-sm text-slate-400">Timestamp</p>
              <p className="text-sm text-slate-200">{formatDate(data.created_at)}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}