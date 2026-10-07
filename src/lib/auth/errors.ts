/**
 * App-facing error type for the auth API.
 *
 * Every auth function returns a result object instead of throwing, so callers
 * never need `try`/`catch` and a forgotten `catch` cannot produce an unhandled
 * rejection. Errors are normalised into a small closed union: the UI can
 * exhaustively switch on `code` and show a real message, while `rawCode`
 * preserves Supabase's original identifier for logging.
 */

import { isAuthError } from '@supabase/supabase-js';

import { fail, ok, type Result } from '@/lib/result';

export { fail, ok };

/** Every failure the auth API can report. */
export type AuthErrorCode =
  /** Supabase returns one message for "no such user" and "wrong password" on purpose. */
  | 'invalid_credentials'
  /** Account exists but the email has not been confirmed yet. */
  | 'email_not_confirmed'
  /** Sign-up attempted for an address that already has an account. */
  | 'user_already_exists'
  /** Address failed Supabase's format validation. */
  | 'email_address_invalid'
  /** Password rejected by the project's minimum-strength rules. */
  | 'weak_password'
  /** Too many attempts from this client/IP; retry after the rate-limit window. */
  | 'over_request_rate_limit'
  /** New sign-ups are disabled in the Supabase project. */
  | 'signup_disabled'
  /** Input rejected before the request left the device. */
  | 'validation_failed'
  /** Device offline, DNS failure, or the request timed out. */
  | 'network_error'
  /** Client build is missing configuration. */
  | 'config_error'
  /** Auth is required but no session exists. */
  | 'session_missing'
  /** Anything we could not classify. */
  | 'unknown_error';

/** Normalised, UI-safe auth failure. */
export type AuthError = {
  code: AuthErrorCode;
  /** Safe to render directly in the UI. */
  message: string;
  /** HTTP status from Supabase, when the failure came from the API. */
  status?: number;
  /** Original Supabase error code, for logs and bug reports. */
  rawCode?: string;
};

/** Default copy for each failure mode. */
export const AUTH_ERROR_MESSAGES: Readonly<Record<AuthErrorCode, string>> = Object.freeze({
  invalid_credentials: 'That email and password combination does not match an account.',
  email_not_confirmed: 'Confirm your email address first, then sign in.',
  user_already_exists: 'An account with that email already exists. Try signing in.',
  email_address_invalid: 'That does not look like a valid email address.',
  weak_password: 'Choose a stronger password — at least 8 characters.',
  over_request_rate_limit: 'Too many attempts. Wait a moment and try again.',
  signup_disabled: 'Creating new accounts is currently unavailable.',
  validation_failed: 'Please check the details you entered.',
  network_error: 'No connection. Check your network and try again.',
  config_error: 'The app is missing its Supabase configuration.',
  session_missing: 'You need to be signed in to do that.',
  unknown_error: 'Something went wrong. Please try again.',
});

/**
 * Supabase error codes we translate. Everything else falls through to
 * `unknown_error`, so a new server-side code degrades gracefully instead of
 * crashing or leaking an internal string to the user.
 *
 * Keys are the canonical codes declared in `@supabase/auth-js`
 * (`node_modules/@supabase/auth-js/dist/module/lib/error-codes.d.ts`). That
 * module's `ErrorCode` type is not re-exported from `@supabase/supabase-js`,
 * so the map is keyed by plain string.
 */
const CODE_MAP: Readonly<Record<string, AuthErrorCode>> = Object.freeze({
  invalid_credentials: 'invalid_credentials',
  email_not_confirmed: 'email_not_confirmed',
  user_not_found: 'invalid_credentials',
  email_exists: 'user_already_exists',
  user_already_exists: 'user_already_exists',
  email_address_invalid: 'email_address_invalid',
  email_address_not_authorized: 'email_address_invalid',
  weak_password: 'weak_password',
  over_request_rate_limit: 'over_request_rate_limit',
  over_email_send_rate_limit: 'over_request_rate_limit',
  signup_disabled: 'signup_disabled',
  email_provider_disabled: 'signup_disabled',
  validation_failed: 'validation_failed',
});

/**
 * Builds an error, defaulting the message to the copy registered for the code.
 *
 * Overrides are partial so call sites only supply what they need — and so an
 * accidental extra property is a type error rather than a silent no-op.
 */
export const createAuthError = (
  code: AuthErrorCode,
  overrides: Partial<Pick<AuthError, 'message' | 'status' | 'rawCode'>> = {},
): AuthError => ({
  code,
  message: overrides.message ?? AUTH_ERROR_MESSAGES[code],
  status: overrides.status,
  rawCode: overrides.rawCode,
});

/**
 * Converts anything thrown or returned by Supabase into an `AuthError`.
 *
 * Two details worth noting:
 * - Messages from the server are intentionally *not* forwarded for credential
 *   failures, because GoTrue's wording reveals whether an account exists.
 * - `AuthWeakPasswordError` carries a `reasons` array we use to give a more
 *   useful message than the generic one.
 */
export const toAuthError = (error: unknown): AuthError => {
  if (!isAuthError(error)) {
    // fetch() rejects with a TypeError on a dead network; that is the single
    // most common non-Supabase failure in React Native.
    const isNetworkFailure = error instanceof TypeError;

    return createAuthError(isNetworkFailure ? 'network_error' : 'unknown_error', {
      message: isNetworkFailure
        ? AUTH_ERROR_MESSAGES.network_error
        : error instanceof Error
          ? error.message
          : AUTH_ERROR_MESSAGES.unknown_error,
    });
  }

  const rawCode = error.code ?? undefined;
  const code = (rawCode && CODE_MAP[rawCode]) || 'unknown_error';

  return createAuthError(code, {
    status: error.status,
    rawCode,
    // A weak password is worth calling out precisely: it is the one failure
    // where the user can act immediately on the detail.
    message:
      'reasons' in error && Array.isArray(error.reasons)
        ? describeWeakPassword(error.reasons as string[])
        : AUTH_ERROR_MESSAGES[code],
  });
};

/** Turns Supabase's weak-password reasons into actionable copy. */
const describeWeakPassword = (reasons: string[]): string => {
  if (reasons.includes('length')) {
    return 'Your password needs to be at least 8 characters long.';
  }

  if (reasons.includes('characters')) {
    return 'Use a mix of letters, numbers and symbols.';
  }

  if (reasons.includes('pwned')) {
    return 'That password has appeared in a data breach. Pick a different one.';
  }

  return AUTH_ERROR_MESSAGES.weak_password;
};

/**
 * Result of an auth operation. A `Result` narrowed with this error type, so
 * `result.error.message` is always renderable once `result.ok` is false.
 */
export type AuthResult<T> = Result<T, AuthError>;