-- Migration: relax unexpected NOT NULL columns on `habit_logs`.
--
-- Run: `supabase db push`, or paste into Dashboard -> SQL Editor -> New query.
-- Safe to re-run: each column is touched at most once per run, unknown
-- columns are reported with a notice instead of aborting, and columns the
-- app is required to send (`habit_id`, `user_id`, `log_date`) plus the
-- primary key are never altered.
--
-- WHY THIS EXISTS
--
-- Proof completion failed with Postgres 23502 (NOT NULL violation) on a live
-- database whose `habit_logs` table carries a NOT NULL column with no default
-- that no committed schema ever declared — most likely added by hand in the
-- dashboard. The app only writes the columns it knows (`habit_id`,
-- `user_id`, `log_date`, `completed_at`, `photo_path`, `status`), so any
-- other hard requirement can only be satisfied by relaxing it. New code
-- should keep treating the app as the schema of record: required columns go
-- in `supabase/schema.sql` AND a migration, never only in the dashboard.

do $$
declare
  col record;
begin
  for col in
    select column_name
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'habit_logs'
       and is_nullable = 'NO'
       and column_default is null
       and column_name not in ('id', 'habit_id', 'user_id', 'log_date')
  loop
    begin
      execute format(
        'alter table public.habit_logs alter column %I drop not null',
        col.column_name
      );
      raise notice 'relaxed NOT NULL on habit_logs.%', col.column_name;
    exception when others then
      raise notice 'kept NOT NULL on habit_logs.%: %', col.column_name, sqlerrm;
    end;
  end loop;
end;
$$;
