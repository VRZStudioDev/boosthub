-- Adds a per-user voice automation token.
-- This token is safe to place in a Siri Shortcut URL. It authorizes only that
-- user's decision logging proxy and avoids exposing the Telegram bot token.

alter table public.profiles
  add column if not exists voice_token uuid not null default gen_random_uuid();

create unique index if not exists profiles_voice_token_idx
  on public.profiles (voice_token);