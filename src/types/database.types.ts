/**
 * Database types for BoostHub Supabase tables.
 * Keep in sync with supabase/migrations/0001_init.sql.
 * You can regenerate these with:
 *   supabase gen types typescript --project-id <ref> > src/types/database.types.ts
 */

export type LicenseStatus = 'active' | 'inactive' | 'canceled';
export type UsageStatus = 'success' | 'failed' | 'accept' | 'decline';
export type DecisionStatus = 'accept' | 'decline';
export type VoiceAnalysisDecision = 'accept' | 'decline' | 'marginal' | 'error';
export type VoiceAnalysisStatus = 'success' | 'failed';
export type FraudDecision = 'allow' | 'review' | 'block';
export type FraudReviewStatus = 'none' | 'open' | 'approved' | 'rejected';

export type Profile = {
  id: string;
  email: string;
  license_status: LicenseStatus;
  stripe_customer_id: string | null;
  subscription_id: string | null;
  trial_used_at: string | null;
  first_trial_at: string | null;
  last_trial_denied_reason: string | null;
  fraud_risk_score: number;
  fraud_decision: FraudDecision;
  fraud_review_status: FraudReviewStatus;
  stripe_payment_method_fingerprint: string | null;
  stripe_payment_method_brand: string | null;
  stripe_payment_method_last4: string | null;
  /**
   * @deprecated No longer used for the primary trigger flow. Kept optional so
   * existing rows/`select('*')` don't break. Safe to drop from the DB later
   * (see supabase/reference/deprecate_fields.sql).
   */
  telegram_user_id?: string | null;
  /** Telegram chat_id linked by the user, used by the status/support bot. */
  telegram_chat_id?: string | null;
  /** Per-user token for public Siri Shortcut voice automation URLs. */
  voice_token?: string;
  /** User defaults for server-side order analysis. */
  gas_price: number;
  mpg: number;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
};

export type UsageLog = {
  id: string;
  profile_id: string;
  triggered_at: string;
  created_at: string;
  status: UsageStatus;
  amount: number | null;
  decision: DecisionStatus | null;
  source: 'manual' | 'voice' | 'system';
};

export type VoiceAnalysisLog = {
  id: string;
  profile_id: string;
  voice_token: string | null;
  amount: number | null;
  distance: number | null;
  gas_price: number | null;
  mpg: number | null;
  fuel_cost: number | null;
  net_payout: number | null;
  per_mile: number | null;
  decision: VoiceAnalysisDecision;
  reason: string | null;
  error_message: string | null;
  status: VoiceAnalysisStatus;
  created_at: string;
};

export type AntifraudEvent = {
  id: string;
  event_type: string;
  signal_source: string;
  risk_score: number;
  decision: FraudDecision;
  reason_code: string;
  evidence_json: Record<string, unknown>;
  related_profile_id: string | null;
  related_stripe_customer_id: string | null;
  created_at: string;
};

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
      voice_analysis_logs: {
        Row: VoiceAnalysisLog;
        Insert: Partial<VoiceAnalysisLog> & Pick<VoiceAnalysisLog, 'profile_id'>;
        Update: Partial<VoiceAnalysisLog>;
        Relationships: [];
      };
      antifraud_events: {
        Row: AntifraudEvent;
        Insert: Partial<AntifraudEvent> & Pick<AntifraudEvent, 'event_type' | 'signal_source' | 'decision' | 'reason_code'>;
        Update: Partial<AntifraudEvent>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}
