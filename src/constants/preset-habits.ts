/**
 * Pre-created habit gallery shown on the "Pick a New One" screen.
 *
 * Each category groups a few one-tap presets. Tapping a preset creates a real
 * habit row through `createHabit` — photo proof with a live-camera shot is
 * always required, so presets only carry a title, icon, colour and schedule.
 *
 * Titles are unique across every category: habit names are unique per user in
 * the database, so two presets sharing a title would make the second tap fail
 * with a duplicate-name error.
 */

import type { IoniconName } from '@/constants/demo-data';
import type { WeekdayIndex } from '@/lib/dates';

/** Every day, Monday-first (matches `WeekdayPicker`). */
const DAILY: WeekdayIndex[] = [0, 1, 2, 3, 4, 5, 6];

export type PresetHabit = {
  title: string;
  icon: IoniconName;
  color: string;
  targetDays: WeekdayIndex[];
};

export type PresetCategory = {
  id: string;
  title: string;
  subtitle: string;
  /** Icon drawn in the category artwork tile. */
  icon: IoniconName;
  /** Accent used for the artwork tile. */
  tint: string;
  presets: PresetHabit[];
};

export const PRESET_CATEGORIES: PresetCategory[] = [
  {
    id: 'trending',
    title: 'Trending habits',
    subtitle: 'Take a step in the right direction',
    icon: 'water',
    tint: '#3B82F6',
    presets: [
      { title: 'Drink 8 glasses of water', icon: 'water', color: '#3B82F6', targetDays: DAILY },
      { title: 'Read 10 pages', icon: 'book', color: '#F5B301', targetDays: DAILY },
      { title: 'Take a morning walk', icon: 'walk', color: '#2FBF71', targetDays: [0, 2, 4, 6] },
      { title: 'Meditate 5 minutes', icon: 'leaf', color: '#14B8A6', targetDays: DAILY },
    ],
  },
  {
    id: 'home',
    title: 'Staying at home',
    subtitle: 'Use this time to do something new',
    icon: 'home',
    tint: '#8B5CF6',
    presets: [
      { title: 'Make the bed', icon: 'bed', color: '#8B5CF6', targetDays: DAILY },
      { title: 'Write in a journal', icon: 'create', color: '#F5B301', targetDays: [0, 2, 4] },
      { title: 'Call a loved one', icon: 'call', color: '#EC4899', targetDays: [5, 6] },
      { title: 'Cook a home meal', icon: 'restaurant', color: '#FF7A1A', targetDays: [0, 2, 4] },
    ],
  },
  {
    id: 'care',
    title: 'Preventive care matters',
    subtitle: 'Protect yourself and others',
    icon: 'medkit',
    tint: '#14B8A6',
    presets: [
      { title: 'Take vitamins', icon: 'medkit', color: '#14B8A6', targetDays: DAILY },
      { title: 'Sleep 8 hours', icon: 'moon', color: '#3B82F6', targetDays: DAILY },
      { title: 'Move 30 minutes', icon: 'barbell', color: '#E1121F', targetDays: [0, 1, 3, 5] },
      { title: 'Wash hands often', icon: 'water', color: '#3B82F6', targetDays: DAILY },
    ],
  },
  {
    id: 'must-have',
    title: 'Must-have habits',
    subtitle: 'Small habits, big results',
    icon: 'nutrition',
    tint: '#2FBF71',
    presets: [
      { title: 'Wake up on time', icon: 'alarm', color: '#FF7A1A', targetDays: DAILY },
      { title: 'Plan the day', icon: 'list', color: '#8B5CF6', targetDays: [0, 1, 2, 3, 4] },
      { title: 'No sugary drinks', icon: 'nutrition', color: '#2FBF71', targetDays: DAILY },
      { title: 'Tidy for 10 minutes', icon: 'home', color: '#14B8A6', targetDays: DAILY },
    ],
  },
  {
    id: 'morning',
    title: 'Morning routine',
    subtitle: 'Open the doors to a productive day',
    icon: 'sunny',
    tint: '#F5B301',
    presets: [
      { title: 'Stretch for 5 minutes', icon: 'body', color: '#FF7A1A', targetDays: DAILY },
      { title: 'Eat breakfast', icon: 'restaurant', color: '#F5B301', targetDays: DAILY },
      { title: 'Step into sunlight', icon: 'sunny', color: '#F5B301', targetDays: DAILY },
      { title: 'Review goals', icon: 'flag', color: '#E1121F', targetDays: [0] },
    ],
  },
];

/**
 * Builds the `/habit/new` route params that prefill the create form from a
 * preset: name, icon and colour arrive filled in, and the suggested schedule
 * becomes the initial day selection the user can still change.
 */
export const presetHabitParams = (preset: PresetHabit) => ({
  title: preset.title,
  icon: preset.icon,
  color: preset.color,
  days: preset.targetDays.join(','),
});
