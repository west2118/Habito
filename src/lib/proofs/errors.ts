/**
 * App-facing error type for the proofs API.
 *
 * Mirrors the shape of `HabitError` in `@/lib/habits/errors`: a closed code
 * union, a message that is always safe to render, and the raw PostgREST code
 * retained for logs.
 */

import type { Result } from '@/lib/result';

export type ProofErrorCode =
  /** No signed-in user; the caller must route to sign-in. */
  | 'unauthenticated'
  /** The write violated a database constraint. */
  | 'constraint_violation'
  /** Network unreachable, or the request timed out. */
  | 'network_error'
  /** Reading, uploading or signing the photo failed. */
  | 'storage_error'
  /** Anything unclassified. */
  | 'unknown_error';

/** Normalised, UI-safe proof failure. */
export type ProofError = {
  code: ProofErrorCode;
  message: string;
  /** PostgREST / HTTP status, when the failure came from the database. */
  status?: number;
  /** Original PostgREST error code, for logs and bug reports. */
  rawCode?: string;
  /**
   * Raw database message and hint. Never rendered — logged in dev so the
   * console names the exact column/constraint behind codes like 23502.
   */
  detail?: string;
};

/** Result of a proofs operation. */
export type ProofResult<T> = Result<T, ProofError>;

/** Default copy for each failure mode. */
export const PROOF_ERROR_MESSAGES: Readonly<Record<ProofErrorCode, string>> = Object.freeze({
  unauthenticated: 'You need to be signed in to do that.',
  constraint_violation: 'That change could not be saved. Please try again.',
  network_error: 'No connection. Check your network and try again.',
  storage_error: 'The photo could not be saved. Please try again.',
  unknown_error: 'Something went wrong. Please try again.',
});

/** Builds an error, defaulting the message to the copy registered for the code. */
export const createProofError = (
  code: ProofErrorCode,
  overrides: Partial<Pick<ProofError, 'message' | 'status' | 'rawCode' | 'detail'>> = {},
): ProofError => ({
  code,
  message: overrides.message ?? PROOF_ERROR_MESSAGES[code],
  status: overrides.status,
  rawCode: overrides.rawCode,
  detail: overrides.detail,
});

/**
 * Converts anything thrown or returned by PostgREST into a `ProofError`.
 *
 * PostgREST failures arrive as `{ code, message, details, hint }` rather than
 * `Error` instances, which is why a plain `catch` is not enough.
 */
export const toProofError = (error: unknown): ProofError => {
  if (isPostgrestError(error)) {
    // 23502 is a NOT NULL violation: the row omits a column the live table
    // requires. That is schema drift (the app and the database disagree),
    // never a typo to fix client-side — say so.
    if (error.code === '23502') {
      return createProofError('constraint_violation', {
        status: error.httpStatus,
        rawCode: error.code,
        message: 'Could not save: the database looks out of date. Apply the latest migration and try again.',
        detail: [error.message, error.details, error.hint].filter(Boolean).join(' | '),
      });
    }

    const code: ProofErrorCode =
      error.code === '23505' || error.code === '23514' || error.code === '23503'
        ? 'constraint_violation'
        : 'unknown_error';

    return createProofError(code, {
      status: error.httpStatus,
      rawCode: error.code,
      message: code === 'constraint_violation' ? error.message : PROOF_ERROR_MESSAGES[code],
      detail: [error.message, error.details, error.hint].filter(Boolean).join(' | ') || undefined,
    });
  }

  // fetch() rejects with a TypeError when the device is offline.
  const isNetworkFailure = error instanceof TypeError;

  return createProofError(isNetworkFailure ? 'network_error' : 'unknown_error', {
    message: isNetworkFailure
      ? PROOF_ERROR_MESSAGES.network_error
      : error instanceof Error
        ? error.message
        : PROOF_ERROR_MESSAGES.unknown_error,
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
