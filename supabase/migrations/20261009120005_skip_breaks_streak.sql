-- Migration: a skipped day breaks the streak instead of extending it.
--
-- Run: `supabase db push`, or paste into Dashboard -> SQL Editor -> New query.
-- Safe to re-run: `create or replace` converges the function either way.
--
-- Old rule: any logged day (completed proof *or* skip) added +1 to
-- `streak_current`, so skipping a habit grew the streak. New rule:
-- - completed insert  -> +1 (unchanged);
-- - skipped insert    -> streak resets to 0, longest untouched, and the
--   pre-skip streak is kept on the log row (`streak_at_log`) for history;
-- - completed delete  -> -1, floored at zero (unchanged);
-- - skipped delete (unskip) -> no streak change; it only re-opens the day,
--   and completing the day afterwards adds +1 from zero.
--
-- Net effects this preserves: skip (5 -> 0), unskip (stays 0), complete after
-- a skip (0 -> 1, the streak rebuilds from the broken state).

create or replace function public.apply_habit_streak_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  prior_streak integer;
begin
  if TG_OP = 'INSERT' then
    if NEW.status = 'completed' then
      update public.habits
         set streak_current = streak_current + 1,
             streak_longest = greatest(streak_longest, streak_current + 1)
       where id = NEW.habit_id;
    elsif NEW.status = 'skipped' then
      -- A skipped day breaks the streak: no increment, straight to zero.
      select streak_current into prior_streak
        from public.habits
       where id = NEW.habit_id;

      update public.habits
         set streak_current = 0
       where id = NEW.habit_id;

      -- Remember the pre-skip streak on the log row for history. This UPDATE
      -- cannot recurse: the triggers below fire on INSERT and DELETE only.
      update public.habit_logs
         set streak_at_log = prior_streak
       where id = NEW.id;
    end if;

    return NEW;
  elsif TG_OP = 'DELETE' then
    if OLD.status = 'completed' then
      update public.habits
         set streak_current = greatest(streak_current - 1, 0)
       where id = OLD.habit_id;
    end if;
    -- Deleting a skip (unskip) only re-opens the day: the streak stays
    -- wherever skipping left it. Completing the day afterwards adds +1.

    return OLD;
  end if;

  return null;
end;
$$;
