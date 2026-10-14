/**
 * App-facing error type for the stats API.
 *
 * Mirrors the shape of `HabitError` in `@/lib/habits/errors`: a closed code
 * union, a message that is always safe to render, and the raw PostgREST code
 * retained for logs.
 */

import type { Result } from '@/lib/result';

export type StatsErrorCode =
  /** No signed-in user; the caller must route to sign-in. */
  | 'unauthenticated'
  /** Network unreachable, or the request timed out. */
  | 'network_error'
  /** Anything unclassified. */
  | 'unknown_error';

/** Normalised, UI-safe stats failure. */
export type StatsError = {
  code: StatsErrorCode;
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

/** Result of a stats operation. */
export type StatsResult<T> = Result<T, StatsError>;

/** Default copy for each failure mode. */
export const STATS_ERROR_MESSAGES: Readonly<Record<StatsErrorCode, string>> = Object.freeze({
  unauthenticated: 'You need to be signed in to do that.',
  network_error: 'No connection. Check your network and try again.',
  unknown_error: 'Something went wrong. Please try again.',
});

/** Builds an error, defaulting the message to the copy registered for the code. */
export const createStatsError = (
  code: StatsErrorCode,
  overrides: Partial<Pick<StatsError, 'message' | 'status' | 'rawCode' | 'detail'>> = {},
): StatsError => ({
  code,
  message: overrides.message ?? STATS_ERROR_MESSAGES[code],
  status: overrides.status,
  rawCode: overrides.rawCode,
  detail: overrides.detail,
});

/**
 * Converts anything thrown or returned by PostgREST into a `StatsError`.
 */
export const toStatsError = (error: unknown): StatsError => {
  if (isPostgrestError(error)) {
    return createStatsError('unknown_error', {
      status: error.httpStatus,
      rawCode: error.code,
      detail: [error.message, error.details, error.hint].filter(Boolean).join(' | ') || undefined,
    });
  }

  // fetch() rejects with a TypeError when the device is offline.
  const isNetworkFailure = error instanceof TypeError;

  return createStatsError(isNetworkFailure ? 'network_error' : 'unknown_error', {
    message: isNetworkFailure
      ? STATS_ERROR_MESSAGES.network_error
      : error instanceof Error
        ? error.message
        : STATS_ERROR_MESSAGES.unknown_error,
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
