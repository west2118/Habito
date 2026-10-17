-- Migration: hold sign-up verification codes server-side so an account is
-- created ONLY after its email code verifies.
--
-- Run: `supabase db push`, or paste into Dashboard -> SQL Editor -> New query.
-- Safe to re-run: `create table if not exists` plus guarded RLS/policy drops.
--
-- Why this table exists: `auth.users` rows are created by `signUp`, so the old
-- link/OTP flow could never satisfy "no account without a verified code".
-- The new flow is:
--   1. `request-signup-code` stores a hashed 6-digit code here (15-minute
--      expiry) and emails it. No auth row, no profile, nothing usable.
--   2. `verify-signup-code` checks the code and only then creates the user
--      via the Admin API with `email_confirm: true`.
-- A wrong/expired code — or a user who walks away — leaves zero account rows
-- behind, and that email can never sign in because it was never registered.
--
-- Security: RLS is enabled with NO policies, so only the `service_role` key
-- (i.e. the Edge Functions) can read or write these rows. The anon key the
-- app ships can touch nothing here. Codes are stored as SHA-256 hashes, never
-- plaintext; the password is never stored at all — it lives in app memory and
-- is sent once, with the code, to `verify-signup-code`.

create table if not exists public.pending_signups (
  -- Normalised (lowercase, trimmed) address. One active code per email: a new
  -- request overwrites the previous code and restarts the 15-minute window.
  email         text primary key,
  full_name     text,
  -- Hex SHA-256 of `CODE_PEPPER:code`. The pepper lives in the functions'
  -- secrets, so a leaked table alone cannot be brute-forced offline cheaply.
  code_hash     text not null,
  expires_at    timestamptz not null,
  -- Wrong-code submissions since the code was (re)sent. At the limit the row
  -- is deleted and the user must request a fresh code.
  attempts      integer not null default 0,
  -- Sends in the current rolling hour, for the send-rate limit.
  send_count    integer not null default 1,
  last_sent_at  timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

comment on table public.pending_signups is 'Unverified sign-up codes. Rows must only exist for <= 15 minutes; no auth account exists while a row is pending.';

alter table public.pending_signups enable row level security;

-- Belt and braces: drop any permissive policy a previous run may have left.
drop policy if exists pending_signups_no_access on public.pending_signups;
