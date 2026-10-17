/**
 * Streak helpers — schedule-aware "is this streak still alive?" logic.
 *
 * `habits.streak_current` in the database is a counter: it goes +1 on every
 * completed insert, straight to 0 on a skip, and -1 on a completed delete.
 * Nothing ever resets it when a due day simply passes with no log row, so a
 * stale value survives a missed day (e.g. "1 day streak" with no activity
 * yesterday). These pure helpers mask that staleness on the client: a stored
 * streak only counts when the habit's most recent *due* day was completed
 * (or today is already done).
 *
 * The database trigger in `supabase/schema.sql` (`apply_habit_streak_change`)
 * carries the same rule for future inserts, so a completion after a gap
 * restarts at 1 instead of incrementing the stale counter. Both sides share
 * one definition of "previous due date": the most recent calendar day before
 * the anchor that the habit's `schedule.target_days` marks as due. Habits
 * without a schedule are treated as due every day.
 */

import { addDays, getWeekdayIndex, type IsoDate } from '@/lib/dates';
import type { Habit } from '@/lib/habits/types';

/** How far back to look for a previous due date / recent completions. */
export const STREAK_LOOKBACK_DAYS = 30;

/** "1 day" vs "0/2+ days" — only ever exactly 1 is singular. */
export const streakUnit = (count: number): 'day' | 'days' => (count === 1 ? 'day' : 'days');

/** True when the habit is due on the given Monday-first weekday (0 = Monday). */
export const isHabitDueOnWeekday = (habit: Habit, mondayFirstWeekday: number): boolean => {
  const days = habit.schedule?.target_days;

  // Rows without a schedule predate the jsonb column — treat them as daily
  // rather than silently zeroing a habit the user created.
  if (!Array.isArray(days)) {
    return true;
  }

  return days.includes(mondayFirstWeekday as (typeof days)[number]);
};

/**
 * Most recent due date strictly before `anchorIso`, or null when none is
 * found inside the lookback window (unreachable for valid schedules).
 */
export const getPreviousDueDate = (habit: Habit, anchorIso: IsoDate): IsoDate | null => {
  for (let back = 1; back <= STREAK_LOOKBACK_DAYS; back += 1) {
    const candidate = addDays(anchorIso, -back);

    if (isHabitDueOnWeekday(habit, getWeekdayIndex(candidate))) {
      return candidate;
    }
  }

  return null;
};

/**
 * Effective current streak for display.
 *
 * - 0 stays 0.
 * - Completed on `todayIso` → the stored streak (just extended, still valid).
 * - Otherwise the streak survives only when the most recent *due* day before
 *   today was completed — the user still has today to keep it going.
 * - A missed due day (including yesterday for daily habits) → 0.
 */
export const getEffectiveStreakCurrent = (
  habit: Habit,
  todayIso: IsoDate,
  completedDates: ReadonlySet<IsoDate>,
): number => {
  const stored = habit.streak_current ?? 0;

  if (stored <= 0) {
    return 0;
  }

  if (completedDates.has(todayIso)) {
    return stored;
  }

  const previousDue = getPreviousDueDate(habit, todayIso);

  // No due history to judge by — leave the stored value alone rather than
  // zeroing on a guess.
  if (previousDue === null) {
    return stored;
  }

  return completedDates.has(previousDue) ? stored : 0;
};
