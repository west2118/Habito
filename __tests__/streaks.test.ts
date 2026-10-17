import { addDays, type IsoDate } from '@/lib/dates';
import type { Habit } from '@/lib/habits/types';
import {
  getEffectiveStreakCurrent,
  getPreviousDueDate,
  streakUnit,
} from '@/lib/streaks';

const habitWith = (overrides: Partial<Habit> = {}): Habit =>
  ({
    id: 'habit-id',
    user_id: 'user-id',
    title: 'Test habit',
    icon: null,
    color: null,
    type: 'daily',
    schedule: { target_days: [0, 1, 2, 3, 4, 5, 6] },
    photo_mandatory: true,
    photo_prompt: null,
    proof_source: 'camera',
    due_date: null,
    due_time: null,
    streak_current: 0,
    streak_longest: 0,
    is_archived: false,
    created_at: '',
    updated_at: '',
    ...overrides,
  }) as Habit;

describe('streakUnit', () => {
  test('is singular only for exactly 1', () => {
    expect(streakUnit(0)).toBe('days');
    expect(streakUnit(1)).toBe('day');
    expect(streakUnit(2)).toBe('days');
    expect(streakUnit(10)).toBe('days');
  });
});

describe('getPreviousDueDate', () => {
  test('daily habit points at yesterday', () => {
    const habit = habitWith();
    const today: IsoDate = '2026-10-16';

    expect(getPreviousDueDate(habit, today)).toBe(addDays(today, -1));
  });

  test('weekly habit skips non-due days', () => {
    // Monday-only habit; 2026-10-14 is a Wednesday.
    const habit = habitWith({
      type: 'weekly',
      schedule: { target_days: [0] },
    });
    const today: IsoDate = '2026-10-14';

    expect(getPreviousDueDate(habit, today)).toBe('2026-10-12');
  });
});

describe('getEffectiveStreakCurrent', () => {
  const today: IsoDate = '2026-10-16';

  test('zero stays zero', () => {
    expect(getEffectiveStreakCurrent(habitWith({ streak_current: 0 }), today, new Set())).toBe(0);
  });

  test('completed today keeps the stored streak', () => {
    const habit = habitWith({ streak_current: 3 });

    expect(getEffectiveStreakCurrent(habit, today, new Set([today]))).toBe(3);
  });

  test('daily habit with activity yesterday stays alive', () => {
    const habit = habitWith({ streak_current: 1 });

    expect(
      getEffectiveStreakCurrent(habit, today, new Set([addDays(today, -1)])),
    ).toBe(1);
  });

  test('daily habit with no activity yesterday resets to zero', () => {
    const habit = habitWith({ streak_current: 1 });

    expect(getEffectiveStreakCurrent(habit, today, new Set([addDays(today, -2)]))).toBe(0);
    expect(getEffectiveStreakCurrent(habit, today, new Set())).toBe(0);
  });

  test('weekly habit is not broken by an off day', () => {
    // Monday-only; today is Wednesday and Monday was logged.
    const habit = habitWith({
      type: 'weekly',
      schedule: { target_days: [0] },
      streak_current: 4,
    });

    expect(getEffectiveStreakCurrent(habit, '2026-10-14', new Set(['2026-10-12']))).toBe(4);
  });

  test('weekly habit resets when its last due day was missed', () => {
    const habit = habitWith({
      type: 'weekly',
      schedule: { target_days: [0] },
      streak_current: 4,
    });

    expect(getEffectiveStreakCurrent(habit, '2026-10-14', new Set(['2026-10-05']))).toBe(0);
  });
});
