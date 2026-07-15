-- Adds driver decision tracking to usage_logs.
-- Existing success/failed activity rows remain valid; decision-specific rows
-- use status + decision values of 'accept' or 'decline'.

alter table public.usage_logs
  add column if not exists amount numeric,
  add column if not exists decision text;

alter table public.usage_logs
  drop constraint if exists usage_logs_status_check;

alter table public.usage_logs
  add constraint usage_logs_status_check
  check (status in ('success', 'failed', 'accept', 'decline'));

alter table public.usage_logs
  drop constraint if exists usage_logs_decision_check;

alter table public.usage_logs
  add constraint usage_logs_decision_check
  check (decision is null or decision in ('accept', 'decline'));

create index if not exists usage_logs_profile_decision_triggered_at_idx
  on public.usage_logs (profile_id, decision, triggered_at desc);