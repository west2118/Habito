-- Migration: restart the streak after a missed due day instead of growing it.
--
-- Run: `supabase db push`, or paste into Dashboard -> SQL Editor -> New query.
-- Safe to re-run: `create or replace` converges the function either way.
--
-- Problem: `streak_current` only moves on log writes (+1 on completed insert,
-- 0 on skip, -1 on completed delete). A due day that simply passes with no
-- log row leaves the counter stale, so "1 day streak" survives a missed
-- yesterday — and completing today then grows it to 2 instead of restarting
-- at 1.
--
-- New rule on a completed insert (skips/deletes unchanged):
-- - first completion ever for the habit            -> set to 1 (ignores stale);
-- - previous *due* day (per schedule.target_days)  -> +1 when it was logged,
--   otherwise the gap broke the streak, so restart at 1;
-- - habits without a schedule count as daily.
--
-- Mirrors `src/lib/streaks.ts` (`getEffectiveStreakCurrent`), which masks
-- already-stale counters on the client until the next write corrects them.

create or replace function public.apply_habit_streak_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  prior_streak integer;
  target_days jsonb;
  prev_due date;
  candidate date;
  candidate_dow integer;
  is_due boolean;
  day_index integer;
  has_prior_completion boolean;
  has_prev_completion boolean;
begin
  if TG_OP = 'INSERT' then
    if NEW.status = 'completed' then
      -- Schedule for gap detection: Monday-first 0..6, matching the app.
      select schedule -> 'target_days' into target_days
        from public.habits
       where id = NEW.habit_id;

      -- Most recent due day strictly before the logged date (up to 30 back,
      -- so a once-a-week habit still finds its previous slot).
      prev_due := null;

      for day_index in 1..30 loop
        candidate := (NEW.log_date - day_index);
        candidate_dow := ((extract(isodow from candidate)::integer) - 1);

        if target_days is null
          or jsonb_typeof(target_days) <> 'array'
          or jsonb_array_length(target_days) = 0 then
          is_due := true;
        else
          is_due := target_days @> to_jsonb(candidate_dow);
        end if;

        if is_due then
          prev_due := candidate;
          exit;
        end if;
      end loop;

      select exists (
        select 1
          from public.habit_logs
         where habit_id = NEW.habit_id
           and status = 'completed'
           and log_date < NEW.log_date
           and id <> NEW.id
      ) into has_prior_completion;

      if prev_due is not null then
        select exists (
          select 1
            from public.habit_logs
           where habit_id = NEW.habit_id
             and status = 'completed'
             and log_date = prev_due
             and id <> NEW.id
        ) into has_prev_completion;
      else
        -- No due history to judge by: keep the historic increment behaviour.
        has_prev_completion := true;
      end if;

      if not has_prior_completion then
        -- First proof ever: start at 1 even if the counter is stale.
        update public.habits
           set streak_current = 1,
               streak_longest = greatest(streak_longest, 1)
         where id = NEW.habit_id;
      elsif prev_due is not null and not has_prev_completion then
        -- Gap since the previous due day: the streak broke, restart at 1.
        update public.habits
           set streak_current = 1,
               streak_longest = greatest(streak_longest, 1)
         where id = NEW.habit_id;
      else
        update public.habits
           set streak_current = streak_current + 1,
               streak_longest = greatest(streak_longest, streak_current + 1)
         where id = NEW.habit_id;
      end if;
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
