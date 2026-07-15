-- Prevent browser/client updates to sensitive billing/license fields.
-- Service-role requests (Edge Functions/admin jobs) may still update these
-- fields. Authenticated users may update allowed profile fields such as
-- telegram_chat_id, while this trigger blocks direct tampering with billing
-- state from the frontend.

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

  return new;
end;
$$;

drop trigger if exists protect_profile_sensitive_updates on public.profiles;
create trigger protect_profile_sensitive_updates
  before update on public.profiles
  for each row execute function public.prevent_client_profile_sensitive_updates();