-- Migration: maintain `habits` streak counters from `habit_logs`.
--
-- Run: `supabase db push`, or paste into Dashboard -> SQL Editor -> New query.
-- Safe to re-run: the function is replaced and each trigger is dropped first.
--
-- A logged day (completed proof or skip) adds one to `streak_current` and
-- carries `streak_longest` with it; removing a log row (unskipping today)
-- takes one back off, floored at zero. Doing this in a trigger — rather than
-- read-modify-write from the client — keeps concurrent devices from
-- double-counting the same day.

create or replace function public.apply_habit_streak_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if TG_OP = 'INSERT' then
    if NEW.status in ('completed', 'skipped') then
      update public.habits
         set streak_current = streak_current + 1,
             streak_longest = greatest(streak_longest, streak_current + 1)
       where id = NEW.habit_id;
    end if;

    return NEW;
  elsif TG_OP = 'DELETE' then
    update public.habits
       set streak_current = greatest(streak_current - 1, 0)
     where id = OLD.habit_id;

    return OLD;
  end if;

  return null;
end;
$$;

drop trigger if exists habit_logs_streak_on_insert on public.habit_logs;
create trigger habit_logs_streak_on_insert
  after insert on public.habit_logs
  for each row execute function public.apply_habit_streak_change();

drop trigger if exists habit_logs_streak_on_delete on public.habit_logs;
create trigger habit_logs_streak_on_delete
  after delete on public.habit_logs
  for each row execute function public.apply_habit_streak_change();
