-- Atomic per-profile rate-limit check for analyze-order.

create or replace function public.check_voice_rate_limit(
  p_profile_id uuid,
  p_window_start timestamptz,
  p_limit integer
)
returns table(allowed boolean, request_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  next_count integer;
begin
  insert into public.voice_rate_limits (profile_id, window_start, request_count, updated_at)
  values (p_profile_id, p_window_start, 1, now())
  on conflict (profile_id) do update
    set request_count = case
          when public.voice_rate_limits.window_start = excluded.window_start
            then public.voice_rate_limits.request_count + 1
          else 1
        end,
        window_start = excluded.window_start,
        updated_at = now()
  returning public.voice_rate_limits.request_count into next_count;

  return query select next_count <= p_limit, next_count;
end;
$$;