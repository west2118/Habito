/**
 * App-facing error type for the habits API.
 *
 * Mirrors the shape of `AuthError` in `@/lib/auth/errors`: a closed code
 * union, a message that is always safe to render, and the raw PostgREST code
 * retained for logs. Keeping the two modules structurally identical means a
 * form screen can handle auth and habit failures the same way.
 */

import type { Result } from '@/lib/result';

export type HabitErrorCode =
  /** Input rejected before the request left the device. */
  | 'validation_failed'
  /** No signed-in user; the caller must route to sign-in. */
  | 'unauthenticated'
  /** The write violated a database constraint (e.g. title length). */
  | 'constraint_violation'
  /** Network unreachable, or the request timed out. */
  | 'network_error'
  /** Client build is missing configuration. */
  | 'config_error'
  /** Anything unclassified. */
  | 'unknown_error';

/** Normalised, UI-safe habit failure. */
export type HabitError = {
  code: HabitErrorCode;
  message: string;
  /** PostgREST / HTTP status, when the failure came from the database. */
  status?: number;
  /** Original PostgREST error code, for logs and bug reports. */
  rawCode?: string;
};

/** Result of a habits operation. */
export type HabitResult<T> = Result<T, HabitError>;

/** Default copy for each failure mode. */
export const HABIT_ERROR_MESSAGES: Readonly<Record<HabitErrorCode, string>> = Object.freeze({
  validation_failed: 'Please check the details you entered.',
  unauthenticated: 'You need to be signed in to do that.',
  constraint_violation: 'That change could not be saved. Please review the details.',
  network_error: 'No connection. Check your network and try again.',
  config_error: 'The app is missing its Supabase configuration.',
  unknown_error: 'Something went wrong. Please try again.',
});

/** Builds an error, defaulting the message to the copy registered for the code. */
export const createHabitError = (
  code: HabitErrorCode,
  overrides: Partial<Pick<HabitError, 'message' | 'status' | 'rawCode'>> = {},
): HabitError => ({
  code,
  message: overrides.message ?? HABIT_ERROR_MESSAGES[code],
  status: overrides.status,
  rawCode: overrides.rawCode,
});

/**
 * Converts anything thrown or returned by PostgREST into a `HabitError`.
 *
 * PostgREST failures arrive as `{ code, message, details, hint }` rather than
 * `Error` instances, which is why a plain `catch` is not enough. Those codes
 * are safe to show: PostgREST only ever describes constraints on the caller's
 * own row, since RLS has already scoped the request to their data.
 */
export const toHabitError = (error: unknown): HabitError => {
  if (isPostgrestError(error)) {
    const code: HabitErrorCode =
      error.code === '23505' || error.code === '23514' || error.code === '23503'
        ? 'constraint_violation'
        : 'unknown_error';

    return createHabitError(code, {
      status: error.httpStatus,
      rawCode: error.code,
      message: code === 'constraint_violation' ? error.message : HABIT_ERROR_MESSAGES[code],
    });
  }

  // fetch() rejects with a TypeError when the device is offline.
  const isNetworkFailure = error instanceof TypeError;

  return createHabitError(isNetworkFailure ? 'network_error' : 'unknown_error', {
    message: isNetworkFailure
      ? HABIT_ERROR_MESSAGES.network_error
      : error instanceof Error
        ? error.message
        : HABIT_ERROR_MESSAGES.unknown_error,
  });
};

/** Structural check for a PostgREST error payload. */
const isPostgrestError = (error: unknown): error is {
  code: string;
  message: string;
  details?: string;
  hint?: string;
  httpStatus?: number;
} =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  'message' in error &&
  typeof (error as { code: unknown }).code === 'string' &&
  typeof (error as { message: unknown }).message === 'string';