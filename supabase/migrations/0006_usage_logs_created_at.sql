-- Compatibility column for reporting queries.
-- The original event timestamp is `triggered_at`; `created_at` mirrors it for
-- SQL reports/tools that expect conventional created_at naming.

alter table public.usage_logs
  add column if not exists created_at timestamptz;

update public.usage_logs
  set created_at = triggered_at
  where created_at is null;

alter table public.usage_logs
  alter column created_at set default now(),
  alter column created_at set not null;

create index if not exists usage_logs_profile_created_at_idx
  on public.usage_logs (profile_id, created_at desc);