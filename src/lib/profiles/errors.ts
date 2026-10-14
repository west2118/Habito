/**
 * App-facing error type for the profiles API.
 *
 * Mirrors the shape of `HabitError` in `@/lib/habits/errors`: a closed code
 * union, a message that is always safe to render, and the raw PostgREST code
 * retained for logs.
 */

import type { Result } from '@/lib/result';

export type ProfileErrorCode =
  /** No signed-in user; the caller must route to sign-in. */
  | 'unauthenticated'
  /** Network unreachable, or the request timed out. */
  | 'network_error'
  /** Anything unclassified. */
  | 'unknown_error';

/** Normalised, UI-safe profile failure. */
export type ProfileError = {
  code: ProfileErrorCode;
  message: string;
  /** PostgREST / HTTP status, when the failure came from the database. */
  status?: number;
  /** Original PostgREST error code, for logs and bug reports. */
  rawCode?: string;
  /**
   * Raw database message and hint. Never rendered — logged in dev so the
   * console names the exact cause.
   */
  detail?: string;
};

/** Result of a profiles operation. */
export type ProfileResult<T> = Result<T, ProfileError>;

/** Default copy for each failure mode. */
export const PROFILE_ERROR_MESSAGES: Readonly<Record<ProfileErrorCode, string>> = Object.freeze({
  unauthenticated: 'You need to be signed in to do that.',
  network_error: 'No connection. Check your network and try again.',
  unknown_error: 'Something went wrong. Please try again.',
});

/** Builds an error, defaulting the message to the copy registered for the code. */
export const createProfileError = (
  code: ProfileErrorCode,
  overrides: Partial<Pick<ProfileError, 'message' | 'status' | 'rawCode' | 'detail'>> = {},
): ProfileError => ({
  code,
  message: overrides.message ?? PROFILE_ERROR_MESSAGES[code],
  status: overrides.status,
  rawCode: overrides.rawCode,
  detail: overrides.detail,
});

/**
 * Converts anything thrown or returned by PostgREST into a `ProfileError`.
 */
export const toProfileError = (error: unknown): ProfileError => {
  if (isPostgrestError(error)) {
    return createProfileError('unknown_error', {
      status: error.httpStatus,
      rawCode: error.code,
      detail: [error.message, error.details, error.hint].filter(Boolean).join(' | ') || undefined,
    });
  }

  // fetch() rejects with a TypeError when the device is offline.
  const isNetworkFailure = error instanceof TypeError;

  return createProfileError(isNetworkFailure ? 'network_error' : 'unknown_error', {
    message: isNetworkFailure
      ? PROFILE_ERROR_MESSAGES.network_error
      : error instanceof Error
        ? error.message
        : PROFILE_ERROR_MESSAGES.unknown_error,
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
