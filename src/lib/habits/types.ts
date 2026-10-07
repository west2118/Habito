/**
 * Types mirroring the `habits` table in `supabase/schema.sql`.
 *
 * The column names and nullability here must stay in step with that file. In
 * particular `proof_source` is an addition to the original spec: the UI has
 * always had a "require a live camera" switch, and `photo_mandatory` cannot
 * express it (a photo can be mandatory *and* still come from the library).
 */

import type { WeekdayIndex } from '@/lib/dates';

/** How a photo proof must be captured. */
export type ProofSource = 'camera' | 'library';

/** Recurrence rule stored in the `schedule` jsonb column. */
export type HabitSchedule = {
  /**
   * Monday-first target days (`0 = Monday … 6 = Sunday`), matching
   * `WeekdayPicker`. An empty list is invalid — a habit must be due somewhere.
   */
  target_days: WeekdayIndex[];
};

/** Cadence derived from the schedule at creation time. */
export type HabitType = 'daily' | 'weekly' | 'custom';

/** A row of the `habits` table, as Supabase returns it. */
export type Habit = {
  id: string;
  user_id: string;
  title: string;
  icon: string | null;
  color: string | null;
  type: HabitType;
  schedule: HabitSchedule;
  photo_mandatory: boolean;
  photo_prompt: string | null;
  proof_source: ProofSource;
  due_date: string | null;
  due_time: string | null;
  streak_current: number;
  streak_longest: number;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
};

/** Fields a client may set when creating a habit. */
export type CreateHabitInput = {
  title: string;
  /** Ionicons name, stored as text so it survives an icon-set change. */
  icon: string;
  /** Monday-first target days. */
  targetDays: WeekdayIndex[];
  /** Whether a photo is required to complete the habit. */
  photoMandatory: boolean;
  /** Prompt shown just before the shutter, e.g. "Photo of your trainers". */
  photoPrompt?: string;
  /** Whether the proof must come from the camera rather than the library. */
  proofSource: ProofSource;
  /** Accent colour (hex). Defaults to the brand red. */
  color?: string;
  /** Optional milestone end date, `YYYY-MM-DD`. */
  dueDate?: string;
  /** Optional target time of day, `HH:MM`. */
  dueTime?: string;
};

/** Fields a client may change after creation. Omitted keys are left alone. */
export type UpdateHabitInput = {
  title?: string;
  icon?: string;
  targetDays?: WeekdayIndex[];
  photoMandatory?: boolean;
  photoPrompt?: string | null;
  proofSource?: ProofSource;
  color?: string | null;
  dueDate?: string | null;
  dueTime?: string | null;
};

/** Brand red, used when a habit has no explicit accent colour. */
export const DEFAULT_HABIT_COLOR = '#E1121F';

/** Longest habit title we accept, matching the design's single-line card. */
export const MAX_TITLE_LENGTH = 60;

/** Longest photo prompt we accept. */
export const MAX_PROMPT_LENGTH = 140;

/**
 * Derives the cadence label from the chosen days.
 *
 * Every day selected is "daily"; a subset is "weekly". The spec allows a
 * "custom" value too, so a selection that is neither (a one-off date range with
 * no recurring days) would report "custom" — but the current UI always submits
 * at least one weekday, so that branch only guards future callers.
 */
export const deriveHabitType = (targetDays: readonly WeekdayIndex[]): HabitType => {
  if (targetDays.length === 0) {
    return 'custom';
  }

  return targetDays.length === 7 ? 'daily' : 'weekly';
};