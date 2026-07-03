-- Adds the Telegram chat linkage used by the status/support bot.
-- The bot looks up a profile by this value to answer /status.

alter table public.profiles
  add column if not exists telegram_chat_id text unique;

-- Allow a user to update their own telegram_chat_id from the Dashboard.
-- (The existing "profiles_update_own" policy already covers UPDATE for the
--  owner; this comment is a reminder that no extra policy is needed.)
