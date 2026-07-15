import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import type { DecisionStatus, UsageLog } from '../types/database.types';

export interface LastVoiceCommand {
  id: string;
  decision: DecisionStatus;
  amount: number | null;
  happenedAt: string;
}

function isDecision(value: UsageLog['decision']): value is DecisionStatus {
  return value === 'accept' || value === 'decline';
}

export function useLastVoiceCommand() {
  const { user } = useAuth();

  return useQuery<LastVoiceCommand | null>({
    queryKey: ['last-voice-command', user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('usage_logs')
        .select('id, decision, amount, created_at, triggered_at')
        .eq('profile_id', user!.id)
        .eq('source', 'voice')
        .not('decision', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      const row = data?.[0];
      if (!row || !isDecision(row.decision)) {
        return null;
      }

      return {
        id: row.id,
        decision: row.decision,
        amount: row.amount,
        happenedAt: row.created_at ?? row.triggered_at,
      };
    },
  });
}