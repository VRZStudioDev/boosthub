import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import type { Profile } from '../types/database.types';

/**
 * Fetches the current user's profile row. The row is auto-created by a
 * database trigger on sign-up (see migrations), so this should resolve
 * shortly after the first login.
 */
export function useProfile() {
  const { user } = useAuth();

  return useQuery<Profile | null>({
    queryKey: ['profile', user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user!.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });
}
