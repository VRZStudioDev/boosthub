-- Phase 3 blocker fixes:
-- 1) Track source of usage_logs so voice commands can be filtered reliably.
-- 2) Allow analyze-order to persist failed analysis attempts in voice_analysis_logs.

alter table public.usage_logs
  add column if not exists source text not null default 'manual';

alter table public.usage_logs
  drop constraint if exists usage_logs_source_check;

alter table public.usage_logs
  add constraint usage_logs_source_check
  check (source in ('manual', 'voice', 'system'));

create index if not exists usage_logs_profile_source_created_at_idx
  on public.usage_logs (profile_id, source, created_at desc);

alter table public.voice_analysis_logs
  add column if not exists voice_token uuid,
  add column if not exists error_message text,
  add column if not exists status text not null default 'success';

alter table public.voice_analysis_logs
  drop constraint if exists voice_analysis_logs_decision_check;

alter table public.voice_analysis_logs
  add constraint voice_analysis_logs_decision_check
  check (decision in ('accept', 'decline', 'marginal', 'error'));

alter table public.voice_analysis_logs
  drop constraint if exists voice_analysis_logs_status_check;

alter table public.voice_analysis_logs
  add constraint voice_analysis_logs_status_check
  check (status in ('success', 'failed'));

alter table public.voice_analysis_logs
  alter column amount drop not null,
  alter column distance drop not null,
  alter column gas_price drop not null,
  alter column mpg drop not null,
  alter column fuel_cost drop not null,
  alter column net_payout drop not null,
  alter column per_mile drop not null,
  alter column reason drop not null;