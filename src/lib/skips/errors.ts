/**
 * App-facing error type for the skip API.
 *
 * Mirrors the shape of `HabitError` in `@/lib/habits/errors`: a closed code
 * union, a message that is always safe to render, and the raw PostgREST code
 * retained for logs.
 */

import type { Result } from '@/lib/result';

export type SkipErrorCode =
  /** No signed-in user; the caller must route to sign-in. */
  | 'unauthenticated'
  /** The write violated a database constraint. */
  | 'constraint_violation'
  /** Network unreachable, or the request timed out. */
  | 'network_error'
  /** Anything unclassified. */
  | 'unknown_error';

/** Normalised, UI-safe skip failure. */
export type SkipError = {
  code: SkipErrorCode;
  message: string;
  /** PostgREST / HTTP status, when the failure came from the database. */
  status?: number;
  /** Original PostgREST error code, for logs and bug reports. */
  rawCode?: string;
};

/** Result of a skip operation. */
export type SkipResult<T> = Result<T, SkipError>;

/** Default copy for each failure mode. */
export const SKIP_ERROR_MESSAGES: Readonly<Record<SkipErrorCode, string>> = Object.freeze({
  unauthenticated: 'You need to be signed in to do that.',
  constraint_violation: 'That change could not be saved. Please try again.',
  network_error: 'No connection. Check your network and try again.',
  unknown_error: 'Something went wrong. Please try again.',
});

/** Builds an error, defaulting the message to the copy registered for the code. */
export const createSkipError = (
  code: SkipErrorCode,
  overrides: Partial<Pick<SkipError, 'message' | 'status' | 'rawCode'>> = {},
): SkipError => ({
  code,
  message: overrides.message ?? SKIP_ERROR_MESSAGES[code],
  status: overrides.status,
  rawCode: overrides.rawCode,
});

/**
 * Converts anything thrown or returned by PostgREST into a `SkipError`.
 *
 * PostgREST failures arrive as `{ code, message, details, hint }` rather than
 * `Error` instances, which is why a plain `catch` is not enough.
 */
export const toSkipError = (error: unknown): SkipError => {
  if (isPostgrestError(error)) {
    const code: SkipErrorCode =
      error.code === '23505' || error.code === '23514' || error.code === '23503'
        ? 'constraint_violation'
        : 'unknown_error';

    return createSkipError(code, {
      status: error.httpStatus,
      rawCode: error.code,
      message: code === 'constraint_violation' ? error.message : SKIP_ERROR_MESSAGES[code],
    });
  }

  // fetch() rejects with a TypeError when the device is offline.
  const isNetworkFailure = error instanceof TypeError;

  return createSkipError(isNetworkFailure ? 'network_error' : 'unknown_error', {
    message: isNetworkFailure
      ? SKIP_ERROR_MESSAGES.network_error
      : error instanceof Error
        ? error.message
        : SKIP_ERROR_MESSAGES.unknown_error,
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
