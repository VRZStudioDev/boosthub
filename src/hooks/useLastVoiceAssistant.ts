import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import type { VoiceAnalysisDecision, VoiceAnalysisStatus } from '../types/database.types';

export interface LastVoiceAssistant {
  id: string;
  status: VoiceAnalysisStatus;
  decision: VoiceAnalysisDecision;
  reason: string | null;
  error_message: string | null;
  per_mile: number | null;
  net_payout: number | null;
  created_at: string;
}

export function useLastVoiceAssistant() {
  const { user } = useAuth();

  return useQuery<LastVoiceAssistant | null>({
    queryKey: ['last-voice-assistant', user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('voice_analysis_logs')
        .select('id, status, decision, reason, error_message, per_mile, net_payout, created_at')
        .eq('profile_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;
      return data?.[0] ?? null;
    },
  });
}