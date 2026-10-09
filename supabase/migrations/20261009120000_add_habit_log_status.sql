-- Migration: add `habit_logs.status` ('completed' | 'skipped').
--
-- Run: `supabase db push`, or paste into Dashboard -> SQL Editor -> New query.
-- Safe to re-run: the column add is guarded and the constraint is
-- dropped before re-adding, matching the convention in `supabase/schema.sql`
-- (which stays the baseline for fresh installs).

alter table public.habit_logs
  add column if not exists status text not null default 'completed';

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
