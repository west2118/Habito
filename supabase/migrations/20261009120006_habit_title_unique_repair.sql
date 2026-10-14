-- Migration: actually enforce unique habit names per user.
--
-- Why this exists: `20261009120004_habit_title_unique.sql` creates
-- `habits_user_title_unique` inside `do $$ ... exception when others`, so on a
-- database that already holds two habits with the same name it prints a notice
-- and creates *nothing* — and that is precisely the database it was written
-- for. Confirmed against the live project: two inserts with the same title are
-- both accepted, so the index does not exist and the only thing standing
-- between the app and duplicate rows was the client-side `hasTitleTaken` guard
-- in `src/lib/habits/habits.ts`.
--
-- That guard only serialises creates inside a single running app instance (its
-- own comment says the database is meant to be the final arbiter), so two app
-- windows — or one stale one — each see "no duplicate" and both insert. Hence
-- "I select a preset, create it, and it is duplicated".
--
-- This migration removes the ambiguity by resolving the duplicates first and
-- creating the index second, so it cannot no-op:
--   1. duplicates that never logged anything are deleted — there is no history
--      to lose;
--   2. duplicates that do hold proofs are renamed instead, so every log,
--      streak and photo survives;
--   3. the oldest row of each name is never touched.
--
-- Review what it will do before running it:
--
--   select user_id, lower(title) as name, count(*) as copies,
--          count(*) filter (where exists (
--            select 1 from public.habit_logs l where l.habit_id = h.id
--          )) as copies_with_history
--     from public.habits h
--    group by 1, 2
--   having count(*) > 1
--    order by copies desc;
--
-- Safe to re-run: with no duplicates left, both repair steps match nothing and
-- the index creation is guarded by `if not exists`.

-- 1. Accidental copies with no history.
with ranked as (
  select
    h.id,
    row_number() over (
      partition by h.user_id, lower(h.title)
      order by h.created_at, h.id
    ) as duplicate_number,
    (select count(*) from public.habit_logs log where log.habit_id = h.id) as log_count
  from public.habits h
)
delete from public.habits
where id in (
  select id from ranked where duplicate_number > 1 and log_count = 0
);

-- 2. Copies that hold proofs: rename rather than delete, so nothing is lost.
--    `title` is plain text with only a not-blank check, so a suffix is always
--    a valid value.
with ranked as (
  select
    id,
    title,
    row_number() over (
      partition by user_id, lower(title)
      order by created_at, id
    ) as duplicate_number
  from public.habits
)
update public.habits h
set title = ranked.title || ' (' || ranked.duplicate_number || ')'
from ranked
where h.id = ranked.id and ranked.duplicate_number > 1;

-- 3. Only now can the index land. Deliberately no exception handler: if this
--    still fails, something is genuinely duplicated or a renamed title now
--    collides with an existing one, and a loud error is what you want instead
--    of another silent notice.
create unique index if not exists habits_user_title_unique
  on public.habits (user_id, lower(title));
