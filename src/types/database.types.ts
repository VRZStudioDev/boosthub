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
  /**
   * @deprecated No longer used for the primary trigger flow. Kept optional so
   * existing rows/`select('*')` don't break. Safe to drop from the DB later
   * (see supabase/reference/deprecate_fields.sql).
   */
  telegram_user_id?: string | null;
  /** Telegram chat_id linked by the user, used by the status/support bot. */
  telegram_chat_id?: string | null;
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
        Relationships: [];
      };
      usage_logs: {
        Row: UsageLog;
        Insert: Partial<UsageLog> & Pick<UsageLog, 'profile_id'>;
        Update: Partial<UsageLog>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}
