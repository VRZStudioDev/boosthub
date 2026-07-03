-- ============================================================================
-- BoostHub — initial schema
-- Tables: profiles, usage_logs
-- Includes Row Level Security policies and a trigger to auto-create a profile
-- row when a new auth user signs up.
-- ============================================================================

-- Enum-like constraints are enforced via CHECK to keep things simple/portable.

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  email              text unique not null,
  license_status     text not null default 'inactive'
                     check (license_status in ('active', 'inactive', 'canceled')),
  stripe_customer_id text unique,
  subscription_id    text,
  telegram_user_id   text,
  current_period_end timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on table public.profiles is 'Per-user profile linked to auth.users.';

-- ---------------------------------------------------------------------------
-- usage_logs
-- ---------------------------------------------------------------------------
create table if not exists public.usage_logs (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references public.profiles (id) on delete cascade,
  triggered_at timestamptz not null default now(),
  status       text not null default 'success'
               check (status in ('success', 'failed'))
);

create index if not exists usage_logs_profile_id_triggered_at_idx
  on public.usage_logs (profile_id, triggered_at desc);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- Auto-create a profile row on new auth user
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.usage_logs enable row level security;

-- profiles: a user can read and update only their own row.
-- Inserts happen via the security-definer trigger; billing fields are updated
-- by Edge Functions using the service role (which bypasses RLS).
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- usage_logs: a user can read only their own logs.
-- Writes are performed by the automation worker / Edge Functions using the
-- service role key, so no client insert policy is granted.
drop policy if exists "usage_logs_select_own" on public.usage_logs;
create policy "usage_logs_select_own"
  on public.usage_logs for select
  using (auth.uid() = profile_id);
