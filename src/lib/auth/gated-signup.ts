/**
 * Gated sign-up API — the account is created ONLY after its email code verifies.
 *
 * Flow: `requestSignupCode` stores a hashed 6-digit code server-side (15-minute
 * expiry) and emails it — no `auth.users` row exists yet. `confirmSignupCode`
 * checks the code and only then creates the user. A wrong/expired code, or a
 * user who walks away, leaves zero account rows behind, and that email can
 * never sign in because it was never registered.
 *
 * These call the `request-signup-code` / `verify-signup-code` Edge Functions
 * (see `supabase/functions/README.md` for the deploy + secrets setup). Like
 * every other API here, both return an `AuthResult` and never throw.
 */

import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';

import { createAuthError, toAuthError, type AuthResult } from '@/lib/auth/errors';
import { fail, ok } from '@/lib/result';
import { getSupabase } from '@/lib/supabase';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

export type RequestSignupCodeInput = {
  email: string;
  fullName?: string;
};

export type ConfirmSignupCodeInput = {
  email: string;
  code: string;
  password: string;
  fullName?: string;
};

/** Error shape the Edge Functions answer with: `{ code, message }`. */
export type FunctionErrorPayload = {
  code?: unknown;
  message?: unknown;
};

/**
 * Maps a function `{ code, message }` payload onto an `AuthError`.
 *
 * Pure (no network), so it is unit-tested directly in `__tests__/gated-signup.test.ts`.
 * The server's message is reused when present because it is already user-safe
 * copy chosen per case.
 */
export const mapFunctionErrorPayload = (payload: FunctionErrorPayload): ReturnType<
  typeof createAuthError
> => {
  const code = typeof payload.code === 'string' ? payload.code : '';
  const message = typeof payload.message === 'string' && payload.message ? payload.message : undefined;
  const overrides = message ? { message } : {};

  switch (code) {
    case 'invalid_email':
      return createAuthError('email_address_invalid', overrides);
    case 'code_invalid':
    case 'no_pending_code':
      return createAuthError('otp_invalid', overrides);
    case 'code_expired':
      return createAuthError('otp_expired', overrides);
    case 'too_many_attempts':
    case 'rate_limited':
      return createAuthError('over_request_rate_limit', overrides);
    case 'email_exists':
      return createAuthError('user_already_exists', overrides);
    case 'weak_password':
      return createAuthError('weak_password', overrides);
    case 'not_configured':
      return createAuthError('config_error', overrides);
    default:
      return createAuthError('unknown_error', overrides);
  }
};

/**
 * Invokes a gated-sign-up Edge Function and normalises every failure.
 *
 * - 404 with an unreadable body means the function is not deployed: an honest
 *   `config_error` instead of a confusing generic failure.
 * - `FunctionsFetchError` (and fetch `TypeError`s) are offline failures.
 * - Anything else from the relay is an `unknown_error`.
 */
const invokeSignupFunction = async (
  name: 'request-signup-code' | 'verify-signup-code',
  body: Record<string, unknown>,
): Promise<AuthResult<null>> => {
  try {
    const supabase = await getSupabase();
    const { error } = await supabase.functions.invoke(name, { body });

    if (error) {
      if (error instanceof FunctionsFetchError || error instanceof TypeError) {
        return fail(createAuthError('network_error'));
      }

      if (error instanceof FunctionsHttpError) {
        const status =
          typeof error.context === 'object' && error.context !== null && 'status' in error.context
            ? (error.context as { status?: unknown }).status
            : undefined;

        if (status === 404) {
          return fail(
            createAuthError('config_error', {
              message: 'Account verification is not set up yet. Try again later.',
            }),
          );
        }

        if (
          typeof error.context === 'object' &&
          error.context !== null &&
          typeof (error.context as { json?: unknown }).json === 'function'
        ) {
          try {
            const payload = (await (error.context as Response).json()) as FunctionErrorPayload;
            return fail(mapFunctionErrorPayload(payload));
          } catch {
            return fail(createAuthError('unknown_error'));
          }
        }

        return fail(createAuthError('unknown_error'));
      }

      return fail(createAuthError('unknown_error'));
    }

    return ok(null);
  } catch (error) {
    return fail(toAuthError(error));
  }
};

/**
 * Step 1: emails a 6-digit code with a 15-minute lifetime.
 *
 * Creates no account — only a hashed pending code server-side. The password
 * is deliberately NOT sent here; it stays in app memory until step 2.
 */
export const requestSignupCode = async (
  input: RequestSignupCodeInput,
): Promise<AuthResult<null>> => {
  if (!EMAIL_PATTERN.test(normalizeEmail(input.email))) {
    return fail(createAuthError('email_address_invalid'));
  }

  return invokeSignupFunction('request-signup-code', {
    email: normalizeEmail(input.email),
    fullName: input.fullName?.trim() || undefined,
  });
};

/**
 * Step 2: verifies the code; the account is created inside this call.
 *
 * Succeeds only when the code matches and is still inside its 15 minutes.
 * Anything else — wrong code, expired code, abandoned flow — creates nothing.
 */
export const confirmSignupCode = async (
  input: ConfirmSignupCodeInput,
): Promise<AuthResult<null>> => {
  if (!EMAIL_PATTERN.test(normalizeEmail(input.email))) {
    return fail(createAuthError('email_address_invalid'));
  }

  if (!/^\d{6}$/.test(input.code.trim())) {
    return fail(
      createAuthError('validation_failed', { message: 'Enter the 6-digit code from your email.' }),
    );
  }

  if (input.password.length === 0) {
    return fail(createAuthError('validation_failed', { message: 'Enter your password.' }));
  }

  return invokeSignupFunction('verify-signup-code', {
    email: normalizeEmail(input.email),
    code: input.code.trim(),
    password: input.password,
    fullName: input.fullName?.trim() || undefined,
  });
};
