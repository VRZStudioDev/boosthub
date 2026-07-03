import type { LicenseStatus, UsageStatus } from '../../types/database.types';

const licenseStyles: Record<LicenseStatus, string> = {
  active: 'border-accent-green/40 bg-accent-green/10 text-accent-green',
  inactive: 'border-slate-500/40 bg-slate-500/10 text-slate-300',
  canceled: 'border-red-500/40 bg-red-500/10 text-red-400',
};

const licenseLabels: Record<LicenseStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
  canceled: 'Canceled',
};

export function LicenseBadge({ status }: { status: LicenseStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${licenseStyles[status]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {licenseLabels[status]}
    </span>
  );
}

const usageStyles: Record<UsageStatus, string> = {
  success: 'border-accent-green/40 bg-accent-green/10 text-accent-green',
  failed: 'border-red-500/40 bg-red-500/10 text-red-400',
};

export function UsageBadge({ status }: { status: UsageStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${usageStyles[status]}`}
    >
      {status}
    </span>
  );
}
