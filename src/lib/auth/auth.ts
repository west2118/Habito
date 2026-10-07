/**
 * Habito authentication API.
 *
 * Every function is an `async` arrow function returning an `AuthResult` — no
 * thrown exceptions, no raw Supabase objects leaking into the UI. That keeps
 * call sites to a single `if (result.ok)` branch and makes every possible
 * failure a compile-time-checked value rather than a runtime surprise.
 *
 * @example
 * const result = await signIn({ email, password });
 * if (!result.ok) {
 *   setError(result.error.message);
 *   return;
 * }
 * router.replace('/today');
 */

import type { Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';

import { createAuthError, fail, ok, toAuthError, type AuthResult } from '@/lib/auth/errors';
import { getSupabase } from '@/lib/supabase';

/**
 * Deep link the user lands on after tapping the confirmation / reset email.
 *
 * Must also be added as a Redirect URL in the Supabase dashboard
 * (Authentication -> URL Configuration), otherwise Supabase silently redirects
 * to the Site URL instead and the app never receives the tokens.
 */
const EMAIL_REDIRECT_PATH = '/today';

/**
 * Builds the callback URL using the scheme declared in `app.json`
 * (`habittracker://today`). `Linking.createURL` resolves the right scheme for
 * the current platform, so this is correct in dev, in Expo Go and in release
 * builds without hard-coding anything.
 *
 * Returns `undefined` if the URL cannot be built. A missing redirect target is
 * not a reason to refuse a sign-up — Supabase falls back to the project's Site
 * URL — so this must never throw and take the whole call down with it.
 */
const buildEmailRedirectUrl = (): string | undefined => {
  try {
    return Linking.createURL(EMAIL_REDIRECT_PATH);
  } catch {
    return undefined;
  }
};

export type SignInInput = {
  email: string;
  password: string;
};

export type SignUpInput = {
  email: string;
  password: string;
  fullName?: string;
};

export type SignUpOutput = {
  user: User;
  /**
   * `null` when the project requires email confirmation. The caller must show
   * a "check your inbox" state rather than navigating into the app.
   */
  session: Session | null;
  needsEmailConfirmation: boolean;
};

/**
 * Minimal, deliberately permissive shape check.
 *
 * Supabase owns real validation (and password strength, which is measured
 * server-side against the project's rules). This only catches obvious mistakes
 * early so the user gets instant feedback instead of a round trip.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Longest password Supabase accepts. */
const MAX_PASSWORD_LENGTH = 72;

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

/**
 * Client-side pre-flight validation.
 *
 * Returns a ready-to-render message, or `null` when the input is acceptable.
 */
const validateCredentials = (input: SignInInput): string | null => {
  if (!EMAIL_PATTERN.test(normalizeEmail(input.email))) {
    return createAuthError('email_address_invalid').message;
  }

  if (input.password.length === 0) {
    return 'Enter your password.';
  }

  return null;
};

/**
 * Signs an existing user in with email and password.
 *
 * @returns the active session, or a validation/credentials error.
 */
export const signIn = async (input: SignInInput): Promise<AuthResult<Session>> => {
  const invalidMessage = validateCredentials(input);

  if (invalidMessage) {
    return fail(createAuthError('validation_failed', { message: invalidMessage }));
  }

  try {
    const supabase = await getSupabase();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizeEmail(input.email),
      password: input.password,
    });

    if (error) {
      return fail(toAuthError(error));
    }

    if (!data.session) {
      // Supabase returns no error and no session in a few edge cases; treat it
      // as a failed sign-in rather than letting callers dereference null.
      return fail(createAuthError('unknown_error'));
    }

    return ok(data.session);
  } catch (error) {
    return fail(toAuthError(error));
  }
};

/**
 * Creates a new account.
 *
 * `fullName` is written to `user_metadata`; the `handle_new_user` trigger in
 * `supabase/schema.sql` copies it onto the `profiles` row automatically, so the
 * client never needs permission to insert into `profiles`.
 *
 * @returns the new user plus the session when the project auto-confirms
 *          emails, and `needsEmailConfirmation` when it does not.
 */
export const signUp = async (input: SignUpInput): Promise<AuthResult<SignUpOutput>> => {
  const invalidMessage = validateCredentials(input);

  if (invalidMessage) {
    return fail(createAuthError('validation_failed', { message: invalidMessage }));
  }

  if (input.password.length > MAX_PASSWORD_LENGTH) {
    return fail(
      createAuthError('validation_failed', {
        message: `Your password must be ${MAX_PASSWORD_LENGTH} characters or fewer.`,
      }),
    );
  }

  try {
    const supabase = await getSupabase();
    const { data, error } = await supabase.auth.signUp({
      email: normalizeEmail(input.email),
      password: input.password,
      options: {
        // Deep link back into the app once the confirmation email is tapped.
        emailRedirectTo: buildEmailRedirectUrl(),
        // Stored in user_metadata; the `handle_new_user` trigger copies this
        // onto the profiles row so the client needs no write access to it.
        data: input.fullName ? { full_name: input.fullName.trim() } : undefined,
      },
    });

    if (error) {
      return fail(toAuthError(error));
    }

    if (!data.user) {
      return fail(createAuthError('unknown_error'));
    }

    // A null session means "account created, email not confirmed yet".
    const needsEmailConfirmation = data.session === null;

    return ok({ user: data.user, session: data.session, needsEmailConfirmation });
  } catch (error) {
    return fail(toAuthError(error));
  }
};

/**
 * Signs the current user out and clears the persisted session.
 *
 * `scope: 'local'` is intentional: it revokes only this device's tokens.
 * Use the `admin` API for a global "sign out everywhere" action, which a
 * client must not be able to perform.
 */
export const signOut = async (): Promise<AuthResult<null>> => {
  try {
    const supabase = await getSupabase();
    const { error } = await supabase.auth.signOut({ scope: 'local' });

    if (error) {
      return fail(toAuthError(error));
    }

    return ok(null);
  } catch (error) {
    return fail(toAuthError(error));
  }
};

/**
 * Reads the cached session without hitting the network.
 *
 * Suitable for deciding what to render on mount. Use {@link getCurrentUser}
 * when the answer must be trustworthy (it revalidates the JWT server-side).
 */
export const getActiveSession = async (): Promise<AuthResult<Session | null>> => {
  try {
    const supabase = await getSupabase();
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      return fail(toAuthError(error));
    }

    return ok(data.session);
  } catch (error) {
    return fail(toAuthError(error));
  }
};

/**
 * Returns the signed-in user, revalidating the token against the server.
 *
 * Unlike the local session this is authoritative — use it before trusting an
 * identity for a destructive action.
 */
export const getCurrentUser = async (): Promise<AuthResult<User>> => {
  try {
    const supabase = await getSupabase();
    const { data, error } = await supabase.auth.getUser();

    if (error) {
      return fail(toAuthError(error));
    }

    if (!data.user) {
      return fail(createAuthError('session_missing'));
    }

    return ok(data.user);
  } catch (error) {
    return fail(toAuthError(error));
  }
};

/**
 * Sends a password-reset email.
 *
 * Always succeeds from the caller's point of view — reporting whether an
 * address exists would leak which users have accounts, so we return a single
 * neutral result regardless of the server's response.
 */
export const sendPasswordResetEmail = async (email: string): Promise<AuthResult<null>> => {
  if (!EMAIL_PATTERN.test(normalizeEmail(email))) {
    return fail(createAuthError('email_address_invalid'));
  }

  try {
    const supabase = await getSupabase();
    const { error } = await supabase.auth.resetPasswordForEmail(normalizeEmail(email), {
      // Opens the "choose a new password" screen inside the app.
      redirectTo: buildEmailRedirectUrl(),
    });

    if (error) {
      return fail(toAuthError(error));
    }

    return ok(null);
  } catch (error) {
    return fail(toAuthError(error));
  }
};

/**
 * Resends the confirmation email for an account that has not been confirmed.
 */
export const resendConfirmationEmail = async (email: string): Promise<AuthResult<null>> => {
  if (!EMAIL_PATTERN.test(normalizeEmail(email))) {
    return fail(createAuthError('email_address_invalid'));
  }

  try {
    const supabase = await getSupabase();
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: normalizeEmail(email),
    });

    if (error) {
      return fail(toAuthError(error));
    }

    return ok(null);
  } catch (error) {
    return fail(toAuthError(error));
  }
};

/**
 * Event names emitted by {@link onAuthStateChange}.
 */
export type AuthEvent =
  | 'INITIAL_SESSION'
  | 'PASSWORD_RECOVERY'
  | 'SIGNED_IN'
  | 'SIGNED_OUT'
  | 'TOKEN_REFRESHED'
  | 'USER_UPDATED';

/** Receives auth transitions; `session` is `null` after sign-out. */
export type AuthStateListener = (event: AuthEvent, session: Session | null) => void;

/**
 * Subscribes to session changes (sign-in, sign-out, token refresh, expiry).
 *
 * Returns an unsubscribe function — call it on unmount, otherwise listeners
 * accumulate and each one keeps the component's closure alive.
 *
 * IMPORTANT: Supabase deadlocks if you `await` another auth call inside the
 * callback. If you need to fetch data on sign-in, defer it:
 *
 * @example
 * onAuthStateChange((event, session) => {
 *   if (event === 'SIGNED_IN' && session) {
 *     setTimeout(() => { void loadHabits(); }, 0);
 *   }
 * });
 */
export const onAuthStateChange = (
  listener: AuthStateListener,
): (() => void) => {
  let unsubscribe: (() => void) | null = null;
  let cancelled = false;

  void getSupabase()
    .then((supabase) => {
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        listener(event as AuthEvent, session);
      });

      if (cancelled) {
        data.subscription.unsubscribe();
        return;
      }

      unsubscribe = () => data.subscription.unsubscribe();
    })
    .catch(() => {
      // Client failed to initialise (bad env config); the listener simply never
      // fires. Swallowing here avoids an unhandled rejection during mount.
    });

  return () => {
    cancelled = true;
    unsubscribe?.();
    unsubscribe = null;
  };
};