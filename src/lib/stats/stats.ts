/**
 * Stats API — per-user aggregates for the Analytics screen.
 *
 * Everything is scoped by Row Level Security to `auth.uid()`, so these numbers
 * can only ever describe the signed-in user — never the whole database. Two
 * reads: the habit rows (streaks, totals) and the log rows inside the selected
 * range (completions, skips, active days, chart series).
 *
 * Every function is an `async` arrow function returning a `StatsResult`, so
 * callers handle failure with one `if (!result.ok)` branch and no `try`/`catch`.
 * Nothing here throws.
 */

import { listHabits } from '@/lib/habits/habits';
import { toStatsError, type StatsResult } from '@/lib/stats/errors';
import { addDays, getTodayIsoDate, type IsoDate } from '@/lib/dates';
import { fail, ok } from '@/lib/result';
import { getEffectiveStreakCurrent, STREAK_LOOKBACK_DAYS } from '@/lib/streaks';
import { getSupabase } from '@/lib/supabase';

/** Ranges offered by the Analytics switcher. */
export const STATS_RANGES = ['Week', 'Month', 'Year'] as const;

export type StatsRange = (typeof STATS_RANGES)[number];

/** Days covered by each range, ending today. */
const RANGE_DAYS: Readonly<Record<StatsRange, number>> = Object.freeze({
  Week: 7,
  Month: 30,
  Year: 365,
});

/** Per-user aggregates for one range. */
export type UserStats = {
  range: StatsRange;
  /** First and last calendar dates covered, for captions. */
  startDate: IsoDate;
  endDate: IsoDate;
  /** Active (non-archived) habits. */
  totalHabits: number;
  /** Best current streak across active habits. */
  currentStreak: number;
  /** Best all-time streak across active habits. */
  bestStreak: number;
  /** Completed share of logged days in range, 0–100. */
  completionRate: number;
  /** Completed proofs in range. */
  totalProofs: number;
  /** Distinct days with any log in range. */
  activeDays: number;
  /** Completed proofs per bucket (daily, or monthly for Year). */
  series: number[];
  /** Busiest day in range, if any. */
  bestDay: { date: IsoDate; count: number } | null;
};

/** Month buckets for the Year range: `YYYY-MM` → completed count. */
const monthKey = (isoDate: IsoDate): string => isoDate.slice(0, 7);

/**
 * Loads this user's stats for `range`.
 *
 * Streaks and totals come from the habit rows; everything rate- or
 * volume-shaped comes from the log rows inside the window.
 */
export const getUserStats = async (range: StatsRange): Promise<StatsResult<UserStats>> => {
  try {
    const endDate = getTodayIsoDate();
    const startDate = addDays(endDate, -(RANGE_DAYS[range] - 1));

    const habitsResult = await listHabits({ includeArchived: true });

    if (!habitsResult.ok) {
      return fail(toStatsError(habitsResult.error));
    }

    const active = habitsResult.data.filter((habit) => !habit.is_archived);
    const storedBest = active.reduce((max, habit) => Math.max(max, habit.streak_current ?? 0), 0);
    const bestStreak = active.reduce((max, habit) => Math.max(max, habit.streak_longest ?? 0), 0);

    // Schedule-aware current streak: a stored counter only counts when the
    // habit's most recent *due* day was logged. Falls back to the stored max
    // when the recency read fails, so a network error never flashes zeros.
    let currentStreak = storedBest;

    if (active.length > 0) {
      const supabaseForStreak = await getSupabase();
      const streakStart = addDays(endDate, -(STREAK_LOOKBACK_DAYS - 1));
      const { data: streakRows, error: streakError } = await supabaseForStreak
        .from('habit_logs')
        .select('habit_id, log_date')
        .eq('status', 'completed')
        .gte('log_date', streakStart)
        .lte('log_date', endDate)
        .in(
          'habit_id',
          active.map((habit) => habit.id),
        );

      if (!streakError) {
        const byHabit = new Map<string, Set<IsoDate>>();

        for (const row of (streakRows ?? []) as { habit_id: string; log_date: IsoDate }[]) {
          const set = byHabit.get(row.habit_id) ?? new Set<IsoDate>();
          set.add(row.log_date);
          byHabit.set(row.habit_id, set);
        }

        currentStreak = active.reduce(
          (max, habit) =>
            Math.max(max, getEffectiveStreakCurrent(habit, endDate, byHabit.get(habit.id) ?? new Set())),
          0,
        );
      }
    }

    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('habit_logs')
      .select('log_date, status')
      .gte('log_date', startDate)
      .lte('log_date', endDate);

    if (error) {
      return fail(toStatsError(error));
    }

    const rows = (data ?? []) as { log_date: IsoDate; status: string }[];
    const completed = rows.filter((row) => row.status === 'completed');
    const logged = rows.filter((row) => row.status === 'completed' || row.status === 'skipped');

    const perDay = new Map<IsoDate, number>();

    for (const row of completed) {
      perDay.set(row.log_date, (perDay.get(row.log_date) ?? 0) + 1);
    }

    let series: number[];

    if (range === 'Year') {
      // Twelve month buckets in calendar order.
      const buckets = new Map<string, number>();

      for (const row of completed) {
        const key = monthKey(row.log_date);
        buckets.set(key, (buckets.get(key) ?? 0) + 1);
      }

      series = Array.from(buckets.entries())
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([, count]) => count);
    } else {
      series = Array.from({ length: RANGE_DAYS[range] }, (_, index) => {
        const date = addDays(startDate, index);
        return perDay.get(date) ?? 0;
      });
    }

    let bestDay: UserStats['bestDay'] = null;

    for (const [date, count] of perDay) {
      if (!bestDay || count > bestDay.count) {
        bestDay = { date, count };
      }
    }

    return ok({
      range,
      startDate,
      endDate,
      totalHabits: active.length,
      currentStreak,
      bestStreak,
      completionRate: logged.length === 0 ? 0 : Math.round((completed.length / logged.length) * 100),
      totalProofs: completed.length,
      // Any logged day counts — including skipped-only days.
      activeDays: new Set(rows.map((row) => row.log_date)).size,
      series,
      bestDay,
    });
  } catch (error) {
    return fail(toStatsError(error));
  }
};
