/**
 * Habits API — create, read, update and archive.
 *
 * Every function is an `async` arrow function returning a `HabitResult`, so
 * callers handle failure with one `if (!result.ok)` branch and no `try`/`catch`.
 * Nothing here throws.
 *
 * Row Level Security is the real access control: the `habits` policies in
 * `supabase/schema.sql` already restrict every row to `user_id = auth.uid()`, so
 * these functions never filter by user id in application code beyond setting it
 * on insert. An unprivileged client simply cannot read another user's habits.
 */

import {
  createHabitError,
  toHabitError,
  type HabitError,
  type HabitResult,
} from '@/lib/habits/errors';
import {
  DEFAULT_HABIT_COLOR,
  MAX_PROMPT_LENGTH,
  MAX_TITLE_LENGTH,
  deriveHabitType,
  type CreateHabitInput,
  type Habit,
  type HabitSchedule,
  type UpdateHabitInput,
} from '@/lib/habits/types';
import { WEEKDAY_INDICES } from '@/lib/dates';
import { fail, ok } from '@/lib/result';
import { getSupabase } from '@/lib/supabase';

/** How habits are ordered everywhere in the app: newest first. */
const HABIT_ORDER = 'created_at.desc';

/**
 * Resolves the signed-in user id.
 *
 * Relying on `user_id` from the session (rather than trusting a value passed in
 * by the UI) means a client cannot create a habit owned by somebody else.
 */
const requireUserId = async (): Promise<HabitResult<string>> => {
  const supabase = await getSupabase();
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    return fail(toHabitError(error));
  }

  if (!data.user) {
    return fail(createHabitError('unauthenticated'));
  }

  return ok(data.user.id);
};

/**
 * Validates the create payload.
 *
 * Runs on the device so an obviously invalid form never costs a round trip.
 * The database still enforces its own constraints — this is a UX layer, not the
 * security boundary.
 */
const validateCreateInput = (input: CreateHabitInput): HabitError | null => {
  const title = input.title.trim();

  if (title.length === 0) {
    return createHabitError('validation_failed', { message: 'Give the habit a name.' });
  }

  if (title.length > MAX_TITLE_LENGTH) {
    return createHabitError('validation_failed', {
      message: `Keep the name under ${MAX_TITLE_LENGTH} characters.`,
    });
  }

  if (input.targetDays.length === 0) {
    return createHabitError('validation_failed', {
      message: 'Pick at least one day for this habit.',
    });
  }

  const isValidDay = input.targetDays.every((day) =>
    (WEEKDAY_INDICES as readonly number[]).includes(day),
  );

  if (!isValidDay) {
    return createHabitError('validation_failed', { message: 'That schedule is not valid.' });
  }

  if (input.photoPrompt && input.photoPrompt.trim().length > MAX_PROMPT_LENGTH) {
    return createHabitError('validation_failed', {
      message: `Keep the photo prompt under ${MAX_PROMPT_LENGTH} characters.`,
    });
  }

  return null;
};

/** Deduplicates and sorts weekdays so equal schedules store identically. */
const normalizeDays = (days: CreateHabitInput['targetDays']): CreateHabitInput['targetDays'] =>
  [...new Set(days)].sort((a, b) => a - b);

/**
 * Creates a habit.
 *
 * Streak columns, `is_archived` and `created_at` are left to the database
 * defaults — the client must never be able to claim a streak it has not earned.
 *
 * @returns the created row, including the id needed for logging proofs.
 */
export const createHabit = async (input: CreateHabitInput): Promise<HabitResult<Habit>> => {
  const invalid = validateCreateInput(input);

  if (invalid) {
    return fail(invalid);
  }

  try {
    const userId = await requireUserId();

    if (!userId.ok) {
      return fail(userId.error);
    }

    const targetDays = normalizeDays(input.targetDays);
    const schedule: HabitSchedule = { target_days: targetDays };

    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('habits')
      .insert({
        user_id: userId.data,
        title: input.title.trim(),
        icon: input.icon,
        color: input.color ?? DEFAULT_HABIT_COLOR,
        type: deriveHabitType(targetDays),
        schedule,
        photo_mandatory: input.photoMandatory,
        photo_prompt: input.photoPrompt?.trim() || null,
        proof_source: input.proofSource,
        due_date: input.dueDate ?? null,
        due_time: input.dueTime ?? null,
      })
      // `select` returns the row as Postgres stored it, so defaults and
      // generated values (id, timestamps) come back to the caller.
      .select('*')
      .single();

    if (error) {
      return fail(toHabitError(error));
    }

    return ok(data as Habit);
  } catch (error) {
    return fail(toHabitError(error));
  }
};

/**
 * Lists the signed-in user's active habits, newest first.
 *
 * Archived habits are excluded by default — archiving preserves history rather
 * than deleting it, so the Today screen should not show those.
 */
export const listHabits = async (options?: { includeArchived?: boolean }): Promise<HabitResult<Habit[]>> => {
  try {
    const supabase = await getSupabase();
    let query = supabase.from('habits').select('*');

    if (!options?.includeArchived) {
      query = query.eq('is_archived', false);
    }

    const { data, error } = await query.order(HABIT_ORDER);

    if (error) {
      return fail(toHabitError(error));
    }

    return ok((data ?? []) as Habit[]);
  } catch (error) {
    return fail(toHabitError(error));
  }
};

/** Reads one habit by id. Returns null when it does not exist or is not yours. */
export const getHabit = async (habitId: string): Promise<HabitResult<Habit | null>> => {
  try {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('habits')
      .select('*')
      .eq('id', habitId)
      .maybeSingle();

    if (error) {
      return fail(toHabitError(error));
    }

    // RLS means another user's habit is indistinguishable from a missing one,
    // which is the correct behaviour: it does not confirm the id exists.
    return ok((data as Habit | null) ?? null);
  } catch (error) {
    return fail(toHabitError(error));
  }
};

/**
 * Updates a habit.
 *
 * Only the provided keys are written, so partial updates cannot blank a column
 * by accident. `targetDays` is re-normalised and `type` re-derived, keeping the
 * cadence consistent with the schedule.
 */
export const updateHabit = async (
  habitId: string,
  patch: UpdateHabitInput,
): Promise<HabitResult<Habit>> => {
  try {
    const supabase = await getSupabase();

    const updates: Record<string, unknown> = {};

    if (patch.title !== undefined) {
      const title = patch.title.trim();

      if (title.length === 0 || title.length > MAX_TITLE_LENGTH) {
        return fail(
          createHabitError('validation_failed', { message: 'Enter a valid habit name.' }),
        );
      }

      updates.title = title;
    }

    if (patch.targetDays !== undefined) {
      if (patch.targetDays.length === 0) {
        return fail(
          createHabitError('validation_failed', {
            message: 'Pick at least one day for this habit.',
          }),
        );
      }

      const targetDays = normalizeDays(patch.targetDays);

      updates.schedule = { target_days: targetDays } satisfies HabitSchedule;
      updates.type = deriveHabitType(targetDays);
    }

    if (patch.photoMandatory !== undefined) {
      updates.photo_mandatory = patch.photoMandatory;
    }

    if (patch.photoPrompt !== undefined) {
      const prompt = patch.photoPrompt?.trim() ?? '';

      if (prompt.length > MAX_PROMPT_LENGTH) {
        return fail(
          createHabitError('validation_failed', {
            message: `Keep the photo prompt under ${MAX_PROMPT_LENGTH} characters.`,
          }),
        );
      }

      updates.photo_prompt = prompt || null;
    }

    if (patch.proofSource !== undefined) {
      updates.proof_source = patch.proofSource;
    }

    if (patch.color !== undefined) {
      updates.color = patch.color;
    }

    if (patch.dueDate !== undefined) {
      updates.due_date = patch.dueDate;
    }

    if (patch.dueTime !== undefined) {
      updates.due_time = patch.dueTime;
    }

    const { data, error } = await supabase
      .from('habits')
      .update(updates)
      .eq('id', habitId)
      .select('*')
      .single();

    if (error) {
      return fail(toHabitError(error));
    }

    return ok(data as Habit);
  } catch (error) {
    return fail(toHabitError(error));
  }
};

/**
 * Archives a habit (soft delete).
 *
 * Per the spec, archiving hides the habit while preserving its logs and albums,
 * so the visual history survives. Use `includeArchived: true` when listing to
 * bring it back.
 */
export const archiveHabit = async (habitId: string): Promise<HabitResult<Habit>> => {
  try {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('habits')
      .update({ is_archived: true })
      .eq('id', habitId)
      .select('*')
      .single();

    if (error) {
      return fail(toHabitError(error));
    }

    return ok(data as Habit);
  } catch (error) {
    return fail(toHabitError(error));
  }
};

/** Restores a previously archived habit. */
export const unarchiveHabit = async (habitId: string): Promise<HabitResult<Habit>> => {
  try {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('habits')
      .update({ is_archived: false })
      .eq('id', habitId)
      .select('*')
      .single();

    if (error) {
      return fail(toHabitError(error));
    }

    return ok(data as Habit);
  } catch (error) {
    return fail(toHabitError(error));
  }
};

/**
 * Permanently removes a habit and, by cascade, its logs and albums.
 *
 * Destructive and irreversible — the UI should confirm first. Prefer
 * {@link archiveHabit} unless the user explicitly asks to delete.
 */
export const deleteHabit = async (habitId: string): Promise<HabitResult<null>> => {
  try {
    const supabase = await getSupabase();
    const { error } = await supabase.from('habits').delete().eq('id', habitId);

    if (error) {
      return fail(toHabitError(error));
    }

    return ok(null);
  } catch (error) {
    return fail(toHabitError(error));
  }
};