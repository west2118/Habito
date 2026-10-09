/**
 * Proofs API — upload a captured photo and record today's completion.
 *
 * A completed habit is a `habit_logs` row with `status = 'completed'`,
 * `completed_at` set and `photo_path` pointing at the private `habit-photos`
 * bucket. Object paths are `{user_id}/{habit_id}/{log_date}-{unique}.jpg`,
 * matching the storage policies in `supabase/schema.sql`, and the bucket is
 * private, so viewing always goes through a short-lived signed URL.
 *
 * Every function is an `async` arrow function returning a `ProofResult`, so
 * callers handle failure with one `if (!result.ok)` branch and no `try`/`catch`.
 * Nothing here throws.
 */

import { File } from 'expo-file-system';

import { createProofError, toProofError, type ProofResult } from '@/lib/proofs/errors';
import { getTodayIsoDate, type IsoDate } from '@/lib/dates';
import { fail, ok } from '@/lib/result';
import { getSupabase } from '@/lib/supabase';

/** Private bucket holding every photo proof. */
const PROOF_BUCKET = 'habit-photos';

/** How long a viewing URL stays valid, in seconds. */
const SIGNED_URL_TTL_SECONDS = 300;

/** Today's completion for one habit, as the Today screen reads it. */
export type ProofLog = {
  habit_id: string;
  log_date: IsoDate;
  completed_at: string | null;
  photo_path: string | null;
  status: string;
};

/**
 * Resolves the signed-in user id.
 *
 * Relying on `user_id` from the session (rather than trusting a value passed in
 * by the UI) means a client cannot write a proof owned by somebody else.
 */
const requireUserId = async (): Promise<ProofResult<string>> => {
  const supabase = await getSupabase();
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    return fail(toProofError(error));
  }

  if (!data.user) {
    return fail(createProofError('unauthenticated'));
  }

  return ok(data.user.id);
};

/** Reads today's log row for one habit, or null when there is none. */
const readLogRow = async (
  habitId: string,
  logDate: IsoDate,
): Promise<ProofResult<ProofLog | null>> => {
  try {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('habit_logs')
      .select('habit_id, log_date, completed_at, photo_path, status')
      .eq('habit_id', habitId)
      .eq('log_date', logDate)
      .maybeSingle();

    if (error) {
      return fail(toProofError(error));
    }

    return ok((data as ProofLog | null) ?? null);
  } catch (error) {
    return fail(toProofError(error));
  }
};

/** Subset of the storage client's error shape used to classify failures. */
type StorageUploadError = {
  message: string;
  status?: number;
  statusCode?: string;
};

/**
 * True for configuration failures rather than transport failures: 403 is the
 * RLS policy rejecting the write (schema.sql never applied), 404 is a missing
 * bucket. Retrying the bytes cannot fix either — only a database update can.
 */
const isPolicyError = (error: StorageUploadError): boolean => {
  const statusCode = (error.statusCode ?? '').toLowerCase();
  const message = error.message.toLowerCase();

  return (
    error.status === 403 ||
    error.status === 404 ||
    statusCode === '403' ||
    statusCode === '404' ||
    statusCode === '42501' ||
    message.includes('row-level security') ||
    message.includes('bucket not found') ||
    message.includes('policy')
  );
};

/**
 * Records today's completion with the photo at `localUri`.
 *
 * Uploads the file, then inserts the log row. A day skipped earlier is
 * unskipped first — completing wins over skipping. Re-running for an
 * already-completed day succeeds with the existing row (idempotent), so a
 * double tap after a slow upload cannot duplicate anything.
 */
export const completeHabitWithPhoto = async (
  habitId: string,
  localUri: string,
  logDate: IsoDate = getTodayIsoDate(),
): Promise<ProofResult<ProofLog>> => {
  try {
    const userId = await requireUserId();

    if (!userId.ok) {
      return fail(userId.error);
    }

    const supabase = await getSupabase();

    // A skip and a completion cannot share the day (one row per habit per
    // day), and finishing the habit wins: drop the skipped marker first.
    const { error: unskipError } = await supabase
      .from('habit_logs')
      .delete()
      .eq('habit_id', habitId)
      .eq('log_date', logDate)
      .eq('status', 'skipped');

    if (unskipError) {
      return fail(toProofError(unskipError));
    }

    const photoPath =
      `${userId.data}/${habitId}/${logDate}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}.jpg`;

    const photo = new File(localUri);

    if (!photo.exists || (photo.size ?? 0) === 0) {
      if (__DEV__) {
        console.warn('[Proofs] local photo missing or empty:', {
          localUri,
          exists: photo.exists,
          size: photo.size,
        });
      }

      return fail(createProofError('storage_error'));
    }

    // Upload the file's *bytes* — never the `File` object itself.
    //
    // `expo-file-system`'s `File` only implements the Blob interface; it does
    // not extend the global `Blob` class, so `file instanceof Blob` is false.
    // supabase-js therefore skips its "wrap the Blob in FormData" branch and
    // passes the `File` straight through as the request body, where React
    // Native's `convertRequestBody` has no branch for it. The request goes out
    // with an empty body, storage answers 200, and the bucket ends up holding a
    // zero-byte object — which is why this cannot be fixed by retrying: nothing
    // reports an error. An ArrayBuffer takes React Native's supported binary
    // path, so the real image bytes are what land in Supabase Storage.
    const bytes = await photo.arrayBuffer();
    const uploadOptions = { contentType: 'image/jpeg', upsert: false } as const;

    const uploadError = (
      await supabase.storage.from(PROOF_BUCKET).upload(photoPath, bytes, uploadOptions)
    ).error as (StorageUploadError | null);

    if (uploadError) {
      if (__DEV__) {
        // The full payload names the real cause: 403 = the storage policies
        // from schema.sql were never applied, 404 = the bucket is missing.
        console.warn('[Proofs] photo upload failed:', {
          message: uploadError.message,
          status: uploadError.status,
          statusCode: uploadError.statusCode,
        });
      }

      if (isPolicyError(uploadError)) {
        return fail(
          createProofError('storage_error', {
            message: 'Photo uploads are not set up yet. Update the database and try again.',
          }),
        );
      }

      const message = uploadError.message.toLowerCase();
      const isNetworkFailure = message.includes('network') || message.includes('fetch');

      return fail(
        createProofError(isNetworkFailure ? 'network_error' : 'storage_error', {
          message: isNetworkFailure ? undefined : 'The photo could not be saved. Please try again.',
        }),
      );
    }

    const { data, error: insertError } = await supabase
      .from('habit_logs')
      .insert({
        habit_id: habitId,
        user_id: userId.data,
        log_date: logDate,
        completed_at: new Date().toISOString(),
        photo_path: photoPath,
        status: 'completed',
      })
      .select('habit_id, log_date, completed_at, photo_path, status')
      .single();

    if (insertError) {
      // Best effort: do not orphan the uploaded bytes when the row fails.
      await supabase.storage.from(PROOF_BUCKET).remove([photoPath]);

      // 23505 is the one-row-per-habit-per-day index: the day is already
      // logged (a retry racing itself, or another device). Return it.
      if (insertError.code === '23505') {
        return readLogRow(habitId, logDate).then((existing) => {
          if (!existing.ok || !existing.data) {
            return fail(toProofError(insertError));
          }

          return ok(existing.data);
        });
      }

      return fail(toProofError(insertError));
    }

    return ok(data as ProofLog);
  } catch (error) {
    // A local file read rejects with a plain Error — surface it as storage.
    if (error instanceof Error && !(error instanceof TypeError)) {
      return fail(createProofError('storage_error'));
    }

    return fail(toProofError(error));
  }
};

/**
 * Returns today's completions for the given habits, keyed by habit id.
 *
 * One query for the whole Today list, so the screen does not fan out into a
 * request per card. Habits without a row are simply absent from the map.
 */
export const listTodayCompletions = async (
  habitIds: string[],
  logDate: IsoDate = getTodayIsoDate(),
): Promise<ProofResult<Map<string, ProofLog>>> => {
  try {
    if (habitIds.length === 0) {
      return ok(new Map());
    }

    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('habit_logs')
      .select('habit_id, log_date, completed_at, photo_path, status')
      .eq('log_date', logDate)
      .eq('status', 'completed')
      .in('habit_id', habitIds);

    if (error) {
      return fail(toProofError(error));
    }

    const map = new Map<string, ProofLog>();

    for (const row of (data ?? []) as ProofLog[]) {
      map.set(row.habit_id, row);
    }

    return ok(map);
  } catch (error) {
    return fail(toProofError(error));
  }
};

/**
 * Mints a short-lived viewing URL for a stored proof photo.
 *
 * The bucket is private, so this — never a guessable public URL — is the only
 * way to display a proof.
 */
export const getProofSignedUrl = async (
  photoPath: string,
): Promise<ProofResult<string>> => {
  try {
    const supabase = await getSupabase();
    const { data, error } = await supabase.storage
      .from(PROOF_BUCKET)
      .createSignedUrl(photoPath, SIGNED_URL_TTL_SECONDS);

    if (error) {
      return fail(createProofError('storage_error'));
    }

    return ok(data.signedUrl);
  } catch (error) {
    return fail(toProofError(error));
  }
};

/** One habit's activity on one day, with its display fields joined in. */
export type DayActivity = {
  habitId: string;
  title: string;
  icon: string | null;
  color: string | null;
  status: 'completed' | 'skipped';
  completedAt: string | null;
  photoPath: string | null;
  logDate: IsoDate;
};

/**
 * Returns every logged activity (done + skipped) for one calendar day.
 *
 * The habit's display fields come from an inner join, so rows for habits the
 * caller cannot see are excluded by RLS on both tables.
 */
export const listDayActivity = async (logDate: IsoDate): Promise<ProofResult<DayActivity[]>> => {
  try {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('habit_logs')
      .select('habit_id, log_date, completed_at, photo_path, status, habits ( title, icon, color )')
      .eq('log_date', logDate);

    if (error) {
      return fail(toProofError(error));
    }

    const rows = (data ?? []) as {
      habit_id: string;
      log_date: IsoDate;
      completed_at: string | null;
      photo_path: string | null;
      status: string;
      habits:
        | { title: string; icon: string | null; color: string | null }
        | { title: string; icon: string | null; color: string | null }[]
        | null;
    }[];

    /** PostgREST types every embed as an array; a many-to-one join returns one. */
    const firstHabit = (
      value: (typeof rows)[number]['habits'],
    ): { title: string; icon: string | null; color: string | null } | null =>
      value === null ? null : Array.isArray(value) ? (value[0] ?? null) : value;

    return ok(
      rows.flatMap((row) => {
        const habit = firstHabit(row.habits);

        if (habit === null || (row.status !== 'completed' && row.status !== 'skipped')) {
          return [];
        }

        return [
          {
            habitId: row.habit_id,
            title: habit.title,
            icon: habit.icon,
            color: habit.color,
            status: row.status as DayActivity['status'],
            completedAt: row.completed_at,
            photoPath: row.photo_path,
            logDate: row.log_date,
          },
        ];
      }),
    );
  } catch (error) {
    return fail(toProofError(error));
  }
};
