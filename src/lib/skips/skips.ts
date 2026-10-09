/**
 * Skip API — mark a habit skipped for a day, unskip it, and read skip state.
 *
 * A skip is a `habit_logs` row with `status = 'skipped'` and no photo. The
 * table's `unique (habit_id, log_date)` rule means a habit can only be skipped
 * once per day, and unskipping deletes the row so the day can still be logged
 * or skipped again later.
 *
 * Every function is an `async` arrow function returning a `SkipResult`, so
 * callers handle failure with one `if (!result.ok)` branch and no `try`/`catch`.
 * Nothing here throws.
 *
 * Row Level Security is the real access control: the `habit_logs` policies in
 * `supabase/schema.sql` already restrict every row to `user_id = auth.uid()`.
 */

import { createSkipError, toSkipError, type SkipResult } from '@/lib/skips/errors';
import { getTodayIsoDate, type IsoDate } from '@/lib/dates';
import { fail, ok } from '@/lib/result';
import { getSupabase } from '@/lib/supabase';

/**
 * Resolves the signed-in user id.
 *
 * Relying on `user_id` from the session (rather than trusting a value passed in
 * by the UI) means a client cannot write a skip owned by somebody else.
 */
const requireUserId = async (): Promise<SkipResult<string>> => {
  const supabase = await getSupabase();
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    return fail(toSkipError(error));
  }

  if (!data.user) {
    return fail(createSkipError('unauthenticated'));
  }

  return ok(data.user.id);
};

/**
 * Marks a habit skipped for `logDate` (defaults to today).
 *
 * Idempotent: skipping an already-skipped day succeeds without writing a
 * second row — the unique index would reject it otherwise.
 */
export const skipHabitForDay = async (
  habitId: string,
  logDate: IsoDate = getTodayIsoDate(),
): Promise<SkipResult<null>> => {
  try {
    const userId = await requireUserId();

    if (!userId.ok) {
      return fail(userId.error);
    }

    const supabase = await getSupabase();
    const { error } = await supabase.from('habit_logs').insert({
      habit_id: habitId,
      user_id: userId.data,
      log_date: logDate,
      status: 'skipped',
    });

    if (error) {
      // 23505 is the one-row-per-habit-per-day index: somebody (this device
      // included) already skipped or logged the day. Treat as success.
      if (error.code === '23505') {
        return ok(null);
      }

      return fail(toSkipError(error));
    }

    return ok(null);
  } catch (error) {
    return fail(toSkipError(error));
  }
};

/**
 * Removes a skip for `logDate` (defaults to today), restoring the habit.
 *
 * Only touches `status = 'skipped'` rows, so a completed proof can never be
 * removed by unskipping.
 */
export const unskipHabitForDay = async (
  habitId: string,
  logDate: IsoDate = getTodayIsoDate(),
): Promise<SkipResult<null>> => {
  try {
    const supabase = await getSupabase();
    const { error } = await supabase
      .from('habit_logs')
      .delete()
      .eq('habit_id', habitId)
      .eq('log_date', logDate)
      .eq('status', 'skipped');

    if (error) {
      return fail(toSkipError(error));
    }

    return ok(null);
  } catch (error) {
    return fail(toSkipError(error));
  }
};

/**
 * Returns the ids from `habitIds` that are skipped on `logDate`.
 *
 * One query for the whole Today list, so the screen does not fan out into a
 * request per card.
 */
export const listSkippedHabitIds = async (
  habitIds: string[],
  logDate: IsoDate = getTodayIsoDate(),
): Promise<SkipResult<string[]>> => {
  try {
    if (habitIds.length === 0) {
      return ok([]);
    }

    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('habit_logs')
      .select('habit_id')
      .eq('log_date', logDate)
      .eq('status', 'skipped')
      .in('habit_id', habitIds);

    if (error) {
      return fail(toSkipError(error));
    }

    return ok((data ?? []).map((row) => (row as { habit_id: string }).habit_id));
  } catch (error) {
    return fail(toSkipError(error));
  }
};
