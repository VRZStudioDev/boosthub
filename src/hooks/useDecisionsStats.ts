import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import type { DecisionStatus, UsageStatus } from '../types/database.types';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const SUCCESSFUL_STATUSES: UsageStatus[] = ['success', 'accept', 'decline'];

export interface DecisionsStats {
  accepts: number;
  declines: number;
  totalDecisions: number;
  estimatedSavings: number;
  declineRate: number;
}

function parseAmount(amount: number | null) {
  const value = Number(amount ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function isDecision(value: DecisionStatus | null): value is DecisionStatus {
  return value === 'accept' || value === 'decline';
}

export function useDecisionsStats() {
  const { user } = useAuth();

  return useQuery<DecisionsStats>({
    queryKey: ['decisions-stats', user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const thirtyDaysAgoIso = new Date(Date.now() - THIRTY_DAYS_MS).toISOString();

      const { data, error } = await supabase
        .from('usage_logs')
        .select('decision, amount, status, triggered_at')
        .eq('profile_id', user!.id)
        .gte('triggered_at', thirtyDaysAgoIso)
        .not('decision', 'is', null)
        .in('status', SUCCESSFUL_STATUSES)
        .order('triggered_at', { ascending: false });

      if (error) throw error;

      const summary = (data ?? []).reduce(
        (acc, row) => {
          if (!isDecision(row.decision)) {
            return acc;
          }

          if (row.decision === 'accept') {
            acc.accepts += 1;
          }

          if (row.decision === 'decline') {
            acc.declines += 1;
            acc.estimatedSavings += parseAmount(row.amount);
          }

          return acc;
        },
        {
          accepts: 0,
          declines: 0,
          totalDecisions: 0,
          estimatedSavings: 0,
          declineRate: 0,
        } as DecisionsStats,
      );

      const totalDecisions = summary.accepts + summary.declines;

      return {
        ...summary,
        totalDecisions,
        declineRate: totalDecisions > 0 ? (summary.declines / totalDecisions) * 100 : 0,
      };
    },
  });
}