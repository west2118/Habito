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
const HABIT_ORDER_COLUMN = 'created_at';

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

/** Name of the per-user unique title index in `supabase/schema.sql`. */
const HABIT_TITLE_UNIQUE_INDEX = 'habits_user_title_unique';

/** Primary-key constraint name for the `habits` table. */
const HABIT_PKEY_CONSTRAINT = 'habits_pkey';

/** Matches a UUID v4/v1-style string accepted by the `id uuid` column. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True when `error` is a PostgREST duplicate-title failure. */
const isDuplicateTitleError = (error: unknown): boolean => {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return false;
  }

  const record = error as Record<string, unknown>;

  return (
    record.code === '23505' &&
    (typeof record.message === 'string' || typeof record.details === 'string') &&
    `${record.message ?? ''} ${record.details ?? ''}`.includes(HABIT_TITLE_UNIQUE_INDEX)
  );
};

/** True when `error` is a primary-key conflict — an idempotent replay. */
const isDuplicateIdError = (error: unknown): boolean => {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return false;
  }

  const record = error as Record<string, unknown>;

  if (record.code !== '23505') {
    return false;
  }

  const haystack = `${record.message ?? ''} ${record.details ?? ''} ${record.hint ?? ''}`;

  return (
    haystack.includes(HABIT_PKEY_CONSTRAINT) ||
    haystack.includes('already exists') ||
    haystack.includes('(id)')
  );
};

/**
 * Maps a write failure to a habit error, with one special case: a duplicate
 * name hits the unique index and deserves a message the user can act on,
 * not the generic constraint copy.
 */
const toHabitWriteError = (error: unknown): HabitError => {
  if (isDuplicateTitleError(error)) {
    return createHabitError('validation_failed', {
      message: 'You already have a habit with that name.',
    });
  }

  return toHabitError(error);
};

/** Copy shown when a title is already taken by one of the user's habits. */
const duplicateTitleError = (): HabitError =>
  createHabitError('validation_failed', {
    message: 'You already have a habit with that name.',
  });

/**
 * Escapes the three LIKE wildcard characters so a title can be matched
 * literally with `ilike`. Postgres treats backslash as the default escape.
 */
const escapeLikePattern = (value: string): string =>
  value.replace(/[\\%_]/g, (char) => `\\${char}`);

/**
 * True when the signed-in user already has a habit with this title
 * (case-insensitive, matching the `habits_user_title_unique` index).
 *
 * This is a client-side guard for databases where the unique index was never
 * applied — without it, repeat taps insert duplicate rows instead of failing.
 * RLS already scopes the lookup to the user's own habits. Fail-open: when the
 * lookup itself errors, creation proceeds and the database remains the final
 * arbiter.
 */
const hasTitleTaken = async (
  supabase: Awaited<ReturnType<typeof getSupabase>>,
  title: string,
  excludeId?: string,
): Promise<boolean> => {
  try {
    let query = supabase.from('habits').select('id').ilike('title', escapeLikePattern(title)).limit(1);

    if (excludeId !== undefined) {
      query = query.neq('id', excludeId);
    }

    const { data, error } = await query;

    if (error) {
      if (__DEV__) {
        console.warn('[Habits] title lookup failed, proceeding to insert:', error);
      }

      return false;
    }

    return (data?.length ?? 0) > 0;
  } catch (error) {
    if (__DEV__) {
      console.warn('[Habits] title lookup threw, proceeding to insert:', error);
    }

    return false;
  }
};

/**
 * Generates a UUID v4 for use as an idempotency key.
 *
 * Prefers `crypto.randomUUID` when the runtime provides it, falling back to a
 * `Math.random`-based v4 so this works on Hermes/JSC without new dependencies.
 */
export const newHabitIdempotencyKey = (): string => {
  const randomUUID = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
    ?.randomUUID;

  if (typeof randomUUID === 'function') {
    return randomUUID.call(globalThis.crypto);
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const rand = Math.floor(Math.random() * 16);
    const value = char === 'x' ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });
};

/**
 * App-wide creation queue.
 *
 * Two creates fired in the same instant (double tap, two stacked prefilled
 * forms submitted together) otherwise interleave: both title lookups run
 * before either insert commits, both see "no duplicate", and both insert.
 * Chaining every creation through one promise serializes them in this runtime,
 * so the second lookup always sees the first insert and refuses the duplicate.
 * (Concurrent writers on *other* devices still need the database unique index
 * as the final arbiter.)
 */
let createQueue: Promise<unknown> = Promise.resolve();

const runExclusive = <T>(task: () => Promise<T>): Promise<T> => {
  const result = createQueue.then(task, task);
  // Keep the chain alive whatever the outcome; callers still get their result.
  createQueue = result.catch(() => undefined);
  return result;
};

/**
 * Creates a habit.
 *
 * Streak columns, `is_archived` and `created_at` are left to the database
 * defaults — the client must never be able to claim a streak it has not earned.
 *
 * Idempotency: when `input.idempotencyKey` is supplied it is sent as the row's
 * `id`. A double tap or a retry after a timeout then hits the primary key
 * instead of inserting a second row, and resolves to the already-created row.
 *
 * Serialized: concurrent calls queue behind each other (see `runExclusive`),
 * so a double tap can never slip two identical rows past the title guard.
 *
 * @returns the created row, including the id needed for logging proofs.
 */
export const createHabit = async (input: CreateHabitInput): Promise<HabitResult<Habit>> =>
  runExclusive(() => createHabitInner(input));

const createHabitInner = async (input: CreateHabitInput): Promise<HabitResult<Habit>> => {
  const invalid = validateCreateInput(input);

  if (invalid) {
    return fail(invalid);
  }

  const idempotencyKey = input.idempotencyKey?.trim() || undefined;

  if (idempotencyKey !== undefined && !UUID_PATTERN.test(idempotencyKey)) {
    return fail(
      createHabitError('validation_failed', { message: 'Please try again.' }),
    );
  }

  try {
    const userId = await requireUserId();

    if (!userId.ok) {
      return fail(userId.error);
    }

    const targetDays = normalizeDays(input.targetDays);
    const schedule: HabitSchedule = { target_days: targetDays };
    const title = input.title.trim();

    const supabase = await getSupabase();

    // Friendly duplicate guard before the insert: repeat taps with different
    // idempotency keys (or a database missing the unique title index) would
    // otherwise create one row per tap, like the screenshot's four copies.
    if (await hasTitleTaken(supabase, title)) {
      return fail(duplicateTitleError());
    }

    const { data, error } = await supabase
      .from('habits')
      .insert({
        // Spread first so an explicit id cannot be overridden by accident.
        ...(idempotencyKey !== undefined ? { id: idempotencyKey } : null),
        user_id: userId.data,
        title,
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
      // Idempotent replay: the first insert won, so return its row instead of
      // failing or inserting a duplicate.
      if (idempotencyKey !== undefined && isDuplicateIdError(error)) {
        const existing = await getHabit(idempotencyKey);

        if (existing.ok && existing.data) {
          return ok(existing.data);
        }
      }

      return fail(toHabitWriteError(error));
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

    const { data, error } = await query.order(HABIT_ORDER_COLUMN, { ascending: false });

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

      // Same duplicate guard as creation, excluding the row being renamed.
      if (await hasTitleTaken(supabase, title, habitId)) {
        return fail(duplicateTitleError());
      }

      updates.title = title;
    }

    if (patch.icon !== undefined) {
      updates.icon = patch.icon;
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
      return fail(toHabitWriteError(error));
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
 *
 * The deleted rows are selected back so a delete that matched nothing (wrong
 * id, or RLS denied it because the habit belongs to another user) fails
 * instead of silently reporting success while the habit is still there.
 */
export const deleteHabit = async (habitId: string): Promise<HabitResult<null>> => {
  try {
    const supabase = await getSupabase();
    const { data, error } = await supabase.from('habits').delete().eq('id', habitId).select('id');

    if (error) {
      return fail(toHabitError(error));
    }

    if (!data || data.length === 0) {
      return fail(
        createHabitError('validation_failed', {
          message: 'That habit could not be found. It may already be deleted.',
        }),
      );
    }

    return ok(null);
  } catch (error) {
    return fail(toHabitError(error));
  }
};