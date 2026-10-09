-- ===========================================================================
-- Habito — schema, RLS policies and auth trigger
-- ===========================================================================
-- Run this once in the Supabase SQL Editor (Dashboard -> SQL Editor -> New query).
--
-- Why this file matters for security: the app ships a *publishable* key, which
-- is visible to anyone who unpacks the bundle. The publishable key is
-- anonymous by design, so these RLS policies are the only thing standing
-- between one user and another user's photos. Every table below therefore has
-- RLS enabled and policies scoped to `auth.uid()`.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text unique not null,
  full_name   text,
  avatar_url  text,
  timezone    text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is 'Extended user profile, one row per auth.users entry.';

-- ---------------------------------------------------------------------------
-- Habits
-- ---------------------------------------------------------------------------
create table if not exists public.habits (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles (id) on delete cascade,
  title            text not null,
  icon             text,
  color            text,
  type             text not null default 'daily',
  schedule         jsonb not null default '{}'::jsonb,
  photo_mandatory  boolean not null default true,
  photo_prompt     text,
  -- Added beyond the original spec. `photo_mandatory` cannot express "the proof
  -- must come from the camera rather than the library", which the New habit
  -- form has always offered. 'camera' | 'library'.
  proof_source     text not null default 'camera',
  due_date         date,
  due_time         time,
  streak_current   integer not null default 0,
  streak_longest   integer not null default 0,
  is_archived      boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on column public.habits.schedule is 'Scheduling rules, e.g. {"target_days":[1,3,5]}.';

-- ---------------------------------------------------------------------------
-- Habit logs (the photo proofs)
-- ---------------------------------------------------------------------------
create table if not exists public.habit_logs (
  id            uuid primary key default gen_random_uuid(),
  habit_id      uuid not null references public.habits (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  log_date      date not null,
  timestamp     timestamptz not null default now(),
  completed_at  timestamptz,
  photo_url     text,
  photo_path    text,
  caption       text,
  streak_at_log integer,
  -- 'completed' for a logged proof, 'skipped' for a day the user swiped to
  -- skip. A skipped row carries no photo; unskipping deletes the row.
  status        text not null default 'completed',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- One proof per habit per day: stops duplicate submissions when a user
  -- double-taps the shutter.
  unique (habit_id, log_date)
);

-- ---------------------------------------------------------------------------
-- Habit albums
-- ---------------------------------------------------------------------------
create table if not exists public.habit_albums (
  id                 uuid primary key default gen_random_uuid(),
  habit_id           uuid not null references public.habits (id) on delete cascade,
  user_id            uuid not null references public.profiles (id) on delete cascade,
  title              text not null,
  cover_photo_path   text,
  photo_count        integer not null default 0,
  longest_streak     integer not null default 0,
  frame_theme        text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Forward migrations
-- ---------------------------------------------------------------------------
-- WHY THIS SECTION EXISTS
--
-- `create table if not exists` is a trap: when the table already exists,
-- Postgres skips the *entire* statement — including every column declared
-- inside it. So editing the CREATE TABLE above to add a column does nothing on
-- an existing database, and any constraint referencing that column then fails
-- with `42703: column "..." does not exist`.
--
-- Every column therefore also gets an explicit `add column if not exists`
-- below. That makes this script re-runnable: on a fresh database the CREATE
-- TABLE defines everything and these are no-ops; on an existing one these
-- statements converge the table to the current shape.
--
-- Rule of thumb for this repo: a new column goes in BOTH the CREATE TABLE (for
-- fresh installs) AND here (for existing databases). Going forward, put new
-- database changes in a timestamped file under `supabase/migrations/` instead
-- of asking anyone to re-run this whole script.
alter table public.profiles add column if not exists id          uuid;
alter table public.profiles add column if not exists email       text;
alter table public.profiles add column if not exists full_name   text;
alter table public.profiles add column if not exists avatar_url  text;
alter table public.profiles add column if not exists timezone    text;
alter table public.profiles add column if not exists created_at  timestamptz not null default now();
alter table public.profiles add column if not exists updated_at  timestamptz not null default now();

alter table public.habits add column if not exists id              uuid;
alter table public.habits add column if not exists user_id         uuid;
alter table public.habits add column if not exists title           text;
alter table public.habits add column if not exists icon            text;
alter table public.habits add column if not exists color           text;
alter table public.habits add column if not exists type            text not null default 'daily';
alter table public.habits add column if not exists schedule        jsonb not null default '{}'::jsonb;
alter table public.habits add column if not exists photo_mandatory boolean not null default true;
alter table public.habits add column if not exists photo_prompt    text;
alter table public.habits add column if not exists proof_source    text not null default 'camera';
alter table public.habits add column if not exists due_date        date;
alter table public.habits add column if not exists due_time        time;
alter table public.habits add column if not exists streak_current  integer not null default 0;
alter table public.habits add column if not exists streak_longest  integer not null default 0;
alter table public.habits add column if not exists is_archived     boolean not null default false;
alter table public.habits add column if not exists created_at      timestamptz not null default now();
alter table public.habits add column if not exists updated_at      timestamptz not null default now();

alter table public.habit_logs add column if not exists id            uuid;
alter table public.habit_logs add column if not exists habit_id      uuid;
alter table public.habit_logs add column if not exists user_id       uuid;
alter table public.habit_logs add column if not exists log_date      date;
alter table public.habit_logs add column if not exists timestamp     timestamptz not null default now();
alter table public.habit_logs add column if not exists completed_at  timestamptz;
alter table public.habit_logs add column if not exists photo_url     text;
alter table public.habit_logs add column if not exists photo_path    text;
alter table public.habit_logs add column if not exists caption       text;
alter table public.habit_logs add column if not exists streak_at_log integer;
alter table public.habit_logs add column if not exists status        text not null default 'completed';
alter table public.habit_logs add column if not exists created_at    timestamptz not null default now();
alter table public.habit_logs add column if not exists updated_at    timestamptz not null default now();

alter table public.habit_albums add column if not exists id               uuid;
alter table public.habit_albums add column if not exists habit_id         uuid;
alter table public.habit_albums add column if not exists user_id          uuid;
alter table public.habit_albums add column if not exists title            text;
alter table public.habit_albums add column if not exists cover_photo_path text;
alter table public.habit_albums add column if not exists photo_count      integer not null default 0;
alter table public.habit_albums add column if not exists longest_streak   integer not null default 0;
alter table public.habit_albums add column if not exists frame_theme       text;
alter table public.habit_albums add column if not exists created_at       timestamptz not null default now();
alter table public.habit_albums add column if not exists updated_at       timestamptz not null default now();

-- Backfill proof_source for rows written before the column existed. The column
-- default already covers new rows; this covers the ones already in the table.
update public.habits
   set proof_source = 'camera'
 where proof_source is null;

-- The one-proof-per-habit-per-day rule is declared inline in the CREATE TABLE,
-- which is skipped on an existing database — so declare it as an index, which
-- is idempotent either way.
create unique index if not exists habit_logs_habit_date_unique
  on public.habit_logs (habit_id, log_date);

-- ---------------------------------------------------------------------------
-- Constraints
-- ---------------------------------------------------------------------------
-- Belt and braces: the client only ever sends valid values, but a constraint
-- means a bad write is rejected even if it arrives from a script, a test, or a
-- future client that forgets to validate.
--
-- These are declared as DROP-then-ADD, not "add if not exists".
--
-- That is deliberate. An earlier version of this file used an
-- `if not exists (select 1 from pg_constraint ...)` guard, which quietly left
-- any pre-existing constraint of the same name in place. A stale
-- `habits_type_check` then shadowed the definition below and rejected *every*
-- value — including the three this file allows — so the app could not insert a
-- single habit. This file is the schema of record: re-running it must converge
-- the database onto what is written here, not preserve whatever was there
-- before.
--
-- Each ADD still runs in its own block with an `exception` handler. A
-- pre-existing row that violates a check would otherwise abort the whole script,
-- and because the SQL Editor runs the batch as one transaction, that would roll
-- back the RLS policies too, leaving the app unprotected. A notice is printed
-- instead, so a skipped constraint is visible rather than silent.

-- A habit cannot claim completion without a photo. `photo_path` rather than
-- `photo_url` because the bucket is private: the path is the source of truth,
-- the URL is a short-lived signed URL derived from it.
alter table public.habit_logs drop constraint if exists habit_logs_completed_check;

do $$
begin
  alter table public.habit_logs
    add constraint habit_logs_completed_check
    check (completed_at is null or photo_path is not null);
exception when others then
  raise notice 'skipped habit_logs_completed_check: %', sqlerrm;
end;
$$;

alter table public.habits drop constraint if exists habits_proof_source_check;

do $$
begin
  alter table public.habits
    add constraint habits_proof_source_check
    check (proof_source in ('camera', 'library'));
exception when others then
  raise notice 'skipped habits_proof_source_check: %', sqlerrm;
end;
$$;

alter table public.habits drop constraint if exists habits_type_check;

do $$
begin
  alter table public.habits
    add constraint habits_type_check
    check (type in ('daily', 'weekly', 'custom'));
exception when others then
  raise notice 'skipped habits_type_check: %', sqlerrm;
end;
$$;

alter table public.habits drop constraint if exists habits_title_not_blank_check;

do $$
begin
  alter table public.habits
    add constraint habits_title_not_blank_check
    check (length(trim(title)) > 0);
exception when others then
  raise notice 'skipped habits_title_not_blank_check: %', sqlerrm;
end;
$$;

-- A log row is either a completed proof or a skipped day. Skipped rows carry
-- no photo, so they must stay 'skipped' rather than gaining a completed_at.
alter table public.habit_logs drop constraint if exists habit_logs_status_check;

do $$
begin
  alter table public.habit_logs
    add constraint habit_logs_status_check
    check (status in ('completed', 'skipped'));
exception when others then
  raise notice 'skipped habit_logs_status_check: %', sqlerrm;
end;
$$;

-- `type` has a NOT NULL DEFAULT in the CREATE TABLE, but a column that already
-- existed is skipped by `add column if not exists` above — so an existing table
-- can be left with no default. Backfill it here, then make the default stick.
alter table public.habits alter column type set default 'daily';

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index if not exists habits_user_id_idx        on public.habits (user_id);
create index if not exists habit_logs_user_id_idx    on public.habit_logs (user_id);
create index if not exists habit_logs_habit_date_idx on public.habit_logs (habit_id, log_date desc);
create index if not exists habit_albums_user_id_idx  on public.habit_albums (user_id);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists habits_set_updated_at on public.habits;
create trigger habits_set_updated_at
  before update on public.habits
  for each row execute function public.set_updated_at();

drop trigger if exists habit_logs_set_updated_at on public.habit_logs;
create trigger habit_logs_set_updated_at
  before update on public.habit_logs
  for each row execute function public.set_updated_at();

drop trigger if exists habit_albums_set_updated_at on public.habit_albums;
create trigger habit_albums_set_updated_at
  before update on public.habit_albums
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Auto-create the profile on sign-up
-- ---------------------------------------------------------------------------
-- A SECURITY DEFINER trigger on auth.users: the client cannot insert into
-- profiles until it is signed in, so doing this server-side guarantees every
-- account always has a profile row. It also reads the display name the app
-- passes through user_metadata at sign-up, and captures the device timezone
-- which streak calculation depends on.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, timezone)
  values (
    new.id,
    new.email,
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    coalesce(new.raw_user_meta_data ->> 'timezone', 'UTC')
  )
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
-- `force row level security` also applies the policies to the table owner, so
-- a mistake in a SECURITY DEFINER function cannot quietly bypass them.
alter table public.profiles      enable row level security;
alter table public.habits        enable row level security;
alter table public.habit_logs    enable row level security;
alter table public.habit_albums  enable row level security;

alter table public.profiles      force row level security;
alter table public.habits        force row level security;
alter table public.habit_logs    force row level security;
alter table public.habit_albums  force row level security;

-- Profiles: a user may read and update only their own row. No insert policy —
-- rows are created by the handle_new_user trigger, so a client cannot
-- fabricate a profile for someone else's id.
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Habits
drop policy if exists habits_select_own on public.habits;
create policy habits_select_own on public.habits
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists habits_insert_own on public.habits;
create policy habits_insert_own on public.habits
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists habits_update_own on public.habits;
create policy habits_update_own on public.habits
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists habits_delete_own on public.habits;
create policy habits_delete_own on public.habits
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Habit logs
--
-- Both `user_id = auth.uid()` and `habits.user_id = auth.uid()` are checked.
-- The second half matters: without it a user could write a log against
-- somebody else's habit id and their proof would surface in that habit.
drop policy if exists habit_logs_select_own on public.habit_logs;
create policy habit_logs_select_own on public.habit_logs
  for select to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.habits
      where habits.id = habit_logs.habit_id
        and habits.user_id = (select auth.uid())
    )
  );

drop policy if exists habit_logs_insert_own on public.habit_logs;
create policy habit_logs_insert_own on public.habit_logs
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.habits
      where habits.id = habit_logs.habit_id
        and habits.user_id = (select auth.uid())
    )
  );

drop policy if exists habit_logs_update_own on public.habit_logs;
create policy habit_logs_update_own on public.habit_logs
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists habit_logs_delete_own on public.habit_logs;
create policy habit_logs_delete_own on public.habit_logs
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Habit albums
drop policy if exists habit_albums_select_own on public.habit_albums;
create policy habit_albums_select_own on public.habit_albums
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists habit_albums_insert_own on public.habit_albums;
create policy habit_albums_insert_own on public.habit_albums
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists habit_albums_update_own on public.habit_albums;
create policy habit_albums_update_own on public.habit_albums
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists habit_albums_delete_own on public.habit_albums;
create policy habit_albums_delete_own on public.habit_albums
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Private storage bucket for photo proofs
-- ---------------------------------------------------------------------------
-- private, not public: photo URLs are only resolvable through short-lived
-- signed URLs generated server-side for the owning user, so guessing a path
-- exposes nothing.
--
-- Object paths are `{user_id}/{habit_id}/{log_date}-{random}.jpg`, so the
-- first path segment is always the owner's id and every policy below can
-- scope on it. Re-running this script converges the policies: each is
-- dropped first, then re-created.
insert into storage.buckets (id, name, public)
values ('habit-photos', 'habit-photos', false)
on conflict (id) do nothing;

drop policy if exists "habit-photos insert own" on storage.objects;
create policy "habit-photos insert own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'habit-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "habit-photos read own" on storage.objects;
create policy "habit-photos read own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'habit-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "habit-photos update own" on storage.objects;
create policy "habit-photos update own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'habit-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'habit-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "habit-photos delete own" on storage.objects;
create policy "habit-photos delete own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'habit-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );