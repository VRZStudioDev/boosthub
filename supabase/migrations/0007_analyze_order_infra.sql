-- Serverless voice decision infrastructure.
-- Adds profile defaults used by analyze-order, plus rate-limit and audit tables.

alter table public.profiles
  add column if not exists gas_price numeric not null default 3.50,
  add column if not exists mpg numeric not null default 25;

alter table public.profiles
  drop constraint if exists profiles_gas_price_positive;
alter table public.profiles
  add constraint profiles_gas_price_positive check (gas_price > 0);

alter table public.profiles
  drop constraint if exists profiles_mpg_positive;
alter table public.profiles
  add constraint profiles_mpg_positive check (mpg > 0);

create table if not exists public.voice_rate_limits (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  window_start timestamptz not null,
  request_count integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.voice_rate_limits enable row level security;

create table if not exists public.voice_analysis_logs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  amount numeric not null,
  distance numeric not null,
  gas_price numeric not null,
  mpg numeric not null,
  fuel_cost numeric not null,
  net_payout numeric not null,
  per_mile numeric not null,
  decision text not null check (decision in ('accept', 'decline', 'marginal')),
  reason text not null,
  created_at timestamptz not null default now()
);

alter table public.voice_analysis_logs enable row level security;

drop policy if exists "voice_analysis_logs_select_own" on public.voice_analysis_logs;
create policy "voice_analysis_logs_select_own"
  on public.voice_analysis_logs for select
  using (auth.uid() = profile_id);

create index if not exists voice_analysis_logs_profile_created_at_idx
  on public.voice_analysis_logs (profile_id, created_at desc);