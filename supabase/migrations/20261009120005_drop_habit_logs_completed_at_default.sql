-- Migration: drop unexpected default on `habit_logs.completed_at`.
--
-- Run: `supabase db push`, or paste into Dashboard -> SQL Editor -> New query.
-- Safe to re-run: dropping a non-existent default is a no-op or handled safely.
--
-- WHY THIS EXISTS
--
-- Habit skipping inserts a row with `status = 'skipped'`, which represents a
-- non-completed habit and carries no photo (`photo_path is null`).
-- When `completed_at` carries a DEFAULT (such as `now()`), omitted `completed_at`
-- columns are auto-populated with the current timestamp. This violates the
-- `habit_logs_completed_check` constraint:
--   CHECK (completed_at is null or photo_path is not null)
-- because `completed_at` is non-null while `photo_path` is null.
--
-- `completed_at` must only be set when a habit is actually completed with photo proof.

alter table public.habit_logs alter column completed_at drop default;
