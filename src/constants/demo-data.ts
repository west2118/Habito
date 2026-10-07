/**
 * Demo data used by the design-phase screens.
 *
 * Every screen currently renders from this module so the UI can be reviewed
 * without a backend. When real logic lands (Supabase), screens will read from
 * data hooks instead and this module can be deleted.
 */

import type { ComponentProps } from 'react';

import type { Ionicons } from '@expo/vector-icons';

export type IoniconName = ComponentProps<typeof Ionicons>['name'];

export const demoProfile = {
  fullName: 'John Tapang',
  firstName: 'John',
  greeting: 'Good afternoon, John Tapang',
  email: 'john.tapang@example.com',
  initials: 'JT',
} as const;

export const demoToday = {
  dateLabel: 'Friday, Oct 2',
  syncLabel: 'Synced',
  currentStreak: 0,
  /** 0..1 daily completion progress. */
  dailyProgress: 0,
  completedHabits: 0,
  totalHabits: 1,
  message: "Let's crush today",
} as const;

export type WeekDay = {
  letter: string;
  date: number;
  isToday: boolean;
};

export const demoWeek: WeekDay[] = [
  { letter: 'M', date: 28, isToday: false },
  { letter: 'T', date: 29, isToday: false },
  { letter: 'W', date: 30, isToday: false },
  { letter: 'T', date: 1, isToday: false },
  { letter: 'F', date: 2, isToday: true },
  { letter: 'S', date: 3, isToday: false },
  { letter: 'S', date: 4, isToday: false },
];

export const demoTodayStats = [
  { icon: 'checkmark-circle' as const, value: '0/1', label: 'Done today' },
  { icon: 'flame' as const, value: '0', label: 'Best streak' },
  { icon: 'camera' as const, value: '0', label: 'Total proofs' },
];

export const demoHabit = {
  id: '1',
  title: 'Morning Medication',
  icon: 'medkit' as const,
  streakDays: 6,
} as const;

export const demoRangeOptions = ['Week', 'Month', 'Year'] as const;

export const demoAnalyticsStats = [
  { icon: 'flame' as const, tag: 'now', value: '0', unit: 'days', label: 'Current streak' },
  { icon: 'trophy' as const, tag: 'PR', value: '0', unit: 'days', label: 'Best streak' },
  { icon: 'checkmark-circle' as const, tag: 'tracked', value: '1', unit: 'active', label: 'Total habits' },
  { icon: 'stats-chart' as const, tag: 'today', value: '0', unit: '%', label: 'Completion rate' },
  { icon: 'camera' as const, tag: 'logged', value: '0', unit: 'photos', label: 'Total proofs' },
  { icon: 'calendar' as const, tag: 'streaks', value: '0', unit: 'days', label: 'Active days' },
] as const;

export const demoMonthLabel = 'October 2026';
export const demoSelectedDay = 2;

export type HabitIconOption = {
  icon: IoniconName;
  label: string;
};

export const demoHabitIcons: HabitIconOption[] = [
  { icon: 'barbell', label: 'Workout' },
  { icon: 'book', label: 'Reading' },
  { icon: 'water', label: 'Hydration' },
  { icon: 'leaf', label: 'Calm' },
  { icon: 'create', label: 'Journal' },
  { icon: 'moon', label: 'Sleep' },
  { icon: 'restaurant', label: 'Meals' },
  { icon: 'walk', label: 'Walking' },
  { icon: 'flag', label: 'Event' },
  { icon: 'locate', label: 'Goal' },
];

/** 0 = Monday … 6 = Sunday (matches the reference design's week start). */
export const demoScheduleDays = [0, 1, 2, 3, 4, 5, 6];

export const demoProfileSettings = [
  { label: 'Timezone', value: 'Asia/Manila' },
  { label: 'Daily reminder', value: '8:00 AM' },
  { label: 'Photo quality', value: 'Original' },
] as const;
