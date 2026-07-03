/**
 * Database types for BoostHub Supabase tables.
 * Keep in sync with supabase/migrations/0001_init.sql.
 * You can regenerate these with:
 *   supabase gen types typescript --project-id <ref> > src/types/database.types.ts
 */

export type LicenseStatus = 'active' | 'inactive' | 'canceled';
export type UsageStatus = 'success' | 'failed';

export interface Profile {
  id: string;
  email: string;
  license_status: LicenseStatus;
  stripe_customer_id: string | null;
  subscription_id: string | null;
  telegram_user_id: string | null;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
}

export interface UsageLog {
  id: string;
  profile_id: string;
  triggered_at: string;
  status: UsageStatus;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & Pick<Profile, 'id' | 'email'>;
        Update: Partial<Profile>;
      };
      usage_logs: {
        Row: UsageLog;
        Insert: Partial<UsageLog> & Pick<UsageLog, 'profile_id'>;
        Update: Partial<UsageLog>;
      };
    };
  };
}
