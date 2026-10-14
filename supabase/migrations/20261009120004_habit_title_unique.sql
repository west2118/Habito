-- Migration: one habit name per user (case-insensitive).
--
-- Run: `supabase db push`, or paste into Dashboard -> SQL Editor -> New query.
-- Safe to re-run: index creation is guarded like every other constraint in
-- this repo — a notice is printed instead of aborting the script.
--
-- Titles are trimmed client-side before insert/update, so `lower(title)` is
-- stable. If duplicate names already exist, the index is skipped with a
-- notice: rename the older duplicates, then re-run this file.

do $$
begin
  create unique index habits_user_title_unique
    on public.habits (user_id, lower(title));
exception when others then
  raise notice 'skipped habits_user_title_unique: %. Rename duplicate habit names, then re-run this migration.', sqlerrm;
end;
$$;
