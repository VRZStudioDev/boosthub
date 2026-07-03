import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import type { UsageLog } from '../types/database.types';

/** Fetches the most recent trigger events for the signed-in user. */
export function useUsageLogs(limit = 10) {
  const { user } = useAuth();

  return useQuery<UsageLog[]>({
    queryKey: ['usage_logs', user?.id, limit],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('usage_logs')
        .select('*')
        .eq('profile_id', user!.id)
        .order('triggered_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data ?? [];
    },
  });
}
