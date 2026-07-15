-- Anti-fraud and trial blueprint for Stripe + Supabase.
-- Decisions are backend-only, auditable, and modeled as allow/review/block.

alter table public.profiles
  add column if not exists trial_used_at timestamptz,
  add column if not exists first_trial_at timestamptz,
  add column if not exists last_trial_denied_reason text,
  add column if not exists fraud_risk_score integer not null default 0,
  add column if not exists fraud_decision text not null default 'allow',
  add column if not exists fraud_review_status text not null default 'none',
  add column if not exists stripe_payment_method_fingerprint text,
  add column if not exists stripe_payment_method_brand text,
  add column if not exists stripe_payment_method_last4 text;

alter table public.profiles
  drop constraint if exists profiles_fraud_decision_check;
alter table public.profiles
  add constraint profiles_fraud_decision_check
  check (fraud_decision in ('allow', 'review', 'block'));

alter table public.profiles
  drop constraint if exists profiles_fraud_review_status_check;
alter table public.profiles
  add constraint profiles_fraud_review_status_check
  check (fraud_review_status in ('none', 'open', 'approved', 'rejected'));

create table if not exists public.disposable_email_domains (
  domain text primary key,
  source text not null default 'manual',
  risk_score integer not null default 40,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.disposable_email_domains (domain, source, risk_score, active)
values
  ('mailinator.com', 'seed', 45, true),
  ('10minutemail.com', 'seed', 45, true),
  ('guerrillamail.com', 'seed', 45, true),
  ('tempmail.com', 'seed', 45, true),
  ('yopmail.com', 'seed', 35, true)
on conflict (domain) do nothing;

create table if not exists public.antifraud_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  signal_source text not null,
  risk_score integer not null default 0,
  decision text not null check (decision in ('allow', 'review', 'block')),
  reason_code text not null,
  evidence_json jsonb not null default '{}'::jsonb,
  related_profile_id uuid references public.profiles (id) on delete set null,
  related_stripe_customer_id text,
  created_at timestamptz not null default now()
);

alter table public.antifraud_events enable row level security;

create index if not exists antifraud_events_profile_created_at_idx
  on public.antifraud_events (related_profile_id, created_at desc);
create index if not exists antifraud_events_customer_created_at_idx
  on public.antifraud_events (related_stripe_customer_id, created_at desc);
create index if not exists antifraud_events_decision_created_at_idx
  on public.antifraud_events (decision, created_at desc);
create index if not exists antifraud_events_reason_created_at_idx
  on public.antifraud_events (reason_code, created_at desc);

create table if not exists public.antifraud_ip_rate_limits (
  ip_hash text primary key,
  window_start timestamptz not null,
  request_count integer not null default 0,
  last_decision text not null default 'allow' check (last_decision in ('allow', 'review', 'block')),
  updated_at timestamptz not null default now()
);

alter table public.antifraud_ip_rate_limits enable row level security;

create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  related_stripe_customer_id text,
  related_profile_id uuid references public.profiles (id) on delete set null,
  processed_at timestamptz not null default now(),
  payload_sha256 text,
  status text not null default 'processed' check (status in ('processing', 'processed', 'failed')),
  error_message text
);

alter table public.stripe_webhook_events enable row level security;

create index if not exists stripe_webhook_events_customer_idx
  on public.stripe_webhook_events (related_stripe_customer_id, processed_at desc);

create table if not exists public.fraud_review_queue (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles (id) on delete cascade,
  stripe_customer_id text,
  risk_score integer not null,
  reason_code text not null,
  evidence_json jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open', 'approved', 'rejected')),
  reviewer_note text,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.fraud_review_queue enable row level security;

create index if not exists fraud_review_queue_status_created_at_idx
  on public.fraud_review_queue (status, created_at desc);
create index if not exists fraud_review_queue_profile_idx
  on public.fraud_review_queue (profile_id, created_at desc);

create or replace function public.prevent_client_profile_sensitive_updates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  request_role text;
begin
  request_role := coalesce(
    nullif(auth.jwt() ->> 'role', ''),
    nullif(current_setting('request.jwt.claim.role', true), ''),
    current_user
  );

  if request_role = 'service_role' or current_user = 'service_role' then
    return new;
  end if;

  if new.license_status is distinct from old.license_status then
    raise exception 'license_status cannot be updated from the client';
  end if;
  if new.stripe_customer_id is distinct from old.stripe_customer_id then
    raise exception 'stripe_customer_id cannot be updated from the client';
  end if;
  if new.subscription_id is distinct from old.subscription_id then
    raise exception 'subscription_id cannot be updated from the client';
  end if;
  if new.current_period_end is distinct from old.current_period_end then
    raise exception 'current_period_end cannot be updated from the client';
  end if;
  if new.trial_used_at is distinct from old.trial_used_at then
    raise exception 'trial_used_at cannot be updated from the client';
  end if;
  if new.first_trial_at is distinct from old.first_trial_at then
    raise exception 'first_trial_at cannot be updated from the client';
  end if;
  if new.last_trial_denied_reason is distinct from old.last_trial_denied_reason then
    raise exception 'last_trial_denied_reason cannot be updated from the client';
  end if;
  if new.fraud_risk_score is distinct from old.fraud_risk_score then
    raise exception 'fraud_risk_score cannot be updated from the client';
  end if;
  if new.fraud_decision is distinct from old.fraud_decision then
    raise exception 'fraud_decision cannot be updated from the client';
  end if;
  if new.fraud_review_status is distinct from old.fraud_review_status then
    raise exception 'fraud_review_status cannot be updated from the client';
  end if;
  if new.stripe_payment_method_fingerprint is distinct from old.stripe_payment_method_fingerprint then
    raise exception 'stripe payment method signals cannot be updated from the client';
  end if;

  return new;
end;
$$;