/**
 * Session context for the whole app.
 *
 * This wraps the framework-agnostic API in `@/lib/auth` in a React context so
 * the navigator can guard routes and any screen can read the current session
 * without subscribing to Supabase directly.
 *
 * The provider is the *only* place that mounts an `onAuthStateChange` listener
 * (Supabase deadlocks if a second auth call is awaited inside that callback),
 * so tokens refresh once and every consumer stays in sync. The root layout owns
 * the provider's lifetime — it sits above the navigator — so the subscription
 * is torn down only when the app itself unmounts.
 */

import type { Session } from '@supabase/supabase-js';
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import {
  confirmSignupCode as requestConfirmSignupCode,
  createAuthError,
  fail,
  getActiveSession,
  ok,
  onAuthStateChange,
  signIn as requestSignIn,
  signOut as requestSignOut,
  signUp as requestSignUp,
  verifySignUpCode as requestVerifySignUpCode,
  type AuthResult,
  type SignInInput,
  type SignUpInput,
  type SignUpOutput,
} from '@/lib/auth';

/** Everything a screen needs to render and change the authentication state. */
export type AuthContextValue = {
  /** Current session, or `null` while signed out. */
  session: Session | null;
  /** True until the persisted session has been read from secure storage. */
  isLoading: boolean;
  signIn: (input: SignInInput) => Promise<AuthResult<Session>>;
  signUp: (input: SignUpInput) => Promise<AuthResult<SignUpOutput>>;
  /** Confirms a new account with its 6-digit email code. */
  verifySignUpCode: (email: string, code: string) => Promise<AuthResult<Session>>;
  /**
   * Completes gated sign-up: verifies the code (creating the account inside
   * that call) and signs the new account straight in.
   */
  completeGatedSignup: (
    email: string,
    code: string,
    password: string,
    fullName?: string,
  ) => Promise<AuthResult<Session>>;
  signOut: () => Promise<AuthResult<null>>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Reads the auth context.
 *
 * Throws when used outside the provider: that is always a wiring mistake, and
 * failing loudly at the call site is far easier to debug than a `null` session
 * that silently bounces the user back to sign-in.
 */
export function useAuth(): AuthContextValue {
  const value = use(AuthContext);

  if (value === null) {
    throw new Error('useAuth must be used inside an <AuthProvider>.');
  }

  return value;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    // Rehydrate the persisted session from the keychain once on mount. The
    // auth API never rejects, but guard anyway so a broken client cannot leave
    // the app stuck on the splash screen forever.
    void getActiveSession()
      .then((result) => {
        if (!active) {
          return;
        }

        if (result.ok) {
          setSession(result.data);
        }

        setIsLoading(false);
      })
      .catch(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    // Then follow every transition: sign-in, sign-out, token refresh, expiry.
    const unsubscribe = onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (input: SignInInput) => {
    const result = await requestSignIn(input);

    // Apply the session eagerly so the route guard flips on the same tick the
    // promise resolves, instead of a frame later when the listener fires.
    if (result.ok) {
      setSession(result.data);
    }

    return result;
  }, []);

  const signUp = useCallback(async (input: SignUpInput) => {
    const result = await requestSignUp(input);

    // A session is only present when the project auto-confirms emails; when it
    // is null the account still needs confirming and the user stays signed out.
    if (result.ok && result.data.session) {
      setSession(result.data.session);
    }

    return result;
  }, []);

  const signOut = useCallback(async () => {
    const result = await requestSignOut();

    if (result.ok) {
      setSession(null);
    }

    return result;
  }, []);

  const verifySignUpCode = useCallback(async (email: string, code: string) => {
    const result = await requestVerifySignUpCode(email, code);

    // A verified code signs the new account straight in — the root guard
    // moves it into the app on the next render.
    if (result.ok) {
      setSession(result.data);
    }

    return result;
  }, []);

  const completeGatedSignup = useCallback(
    async (email: string, code: string, password: string, fullName?: string) => {
      const confirmed = await requestConfirmSignupCode({ email, code, password, fullName });

      if (!confirmed.ok) {
        return confirmed;
      }

      // The account now exists (and only now): sign it in to issue the session.
      const login = await requestSignIn({ email, password });

      if (!login.ok) {
        return fail(
          createAuthError('unknown_error', {
            message: 'Your account was created. Sign in with your password.',
          }),
        );
      }

      setSession(login.data);

      return ok(login.data);
    },
    [],
  );

  const value = useMemo<AuthContextValue>(
    () => ({ session, isLoading, signIn, signUp, signOut, verifySignUpCode, completeGatedSignup }),
    [completeGatedSignup, isLoading, session, signIn, signUp, signOut, verifySignUpCode],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
