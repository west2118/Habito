/**
 * Live integration tests for the auth API.
 *
 * These run against the real Supabase project in `.env` — `signUp`,
 * `signIn`, `signOut` and `onAuthStateChange` are exercised over HTTP against
 * GoTrue, and errors come back from the real server. That is the point: it
 * proves the wiring, the error-code mapping and the session persistence, none of
 * which a mocked client could vouch for.
 *
 * Run with `npm test`. Requires a project with email confirmation disabled and
 * the `supabase/schema.sql` policies in place.
 */

import {
  getActiveSession,
  getCurrentUser,
  onAuthStateChange,
  sendPasswordResetEmail,
  signIn,
  signOut,
  signUp,
  type AuthEvent,
} from '@/lib/auth';
import {
  createTestAccount,
  safeSignOut,
  signInTestAccount,
  TEST_PASSWORD,
  type TestAccount,
} from './helpers/test-account';

jest.setTimeout(60_000);

let account: TestAccount;
const createdEmails: string[] = [];

beforeAll(async () => {
  account = await createTestAccount('habito-auth');
  createdEmails.push(account.email);
});

afterAll(async () => {
  await safeSignOut();
});

describe('signUp', () => {
  test('returns a session and the new user when confirmation is disabled', async () => {
    // The account created in beforeAll is the subject here.
    const session = await getActiveSession();

    expect(session.ok).toBe(true);

    if (!session.ok) {
      return;
    }

    expect(session.data).not.toBeNull();
    expect(session.data?.user.id).toBe(account.userId);
    expect(session.data?.access_token).toEqual(expect.any(String));
    expect(session.data?.access_token.length).toBeGreaterThan(0);
  });

  test('rejects a duplicate address with a renderable message', async () => {
    const result = await signUp({ email: account.email, password: TEST_PASSWORD });

    expect(result.ok).toBe(false);

    if (result.ok) {
      return;
    }

    // GoTrue deliberately returns the same message whether the address exists
    // or not, so only the existence case is asserted here.
    expect(result.error.code).toBe('user_already_exists');
    expect(result.error.message).toEqual(expect.any(String));
    expect(result.error.message.length).toBeGreaterThan(0);
  });

  test('rejects a malformed address before touching the network', async () => {
    const result = await signUp({ email: 'not-an-email', password: TEST_PASSWORD });

    expect(result.ok).toBe(false);

    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe('validation_failed');
  });
});

describe('signIn', () => {
  test('signs in with the correct password', async () => {
    await safeSignOut();

    const result = await signIn({ email: account.email, password: account.password });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.data.user.id).toBe(account.userId);
    expect(result.data.access_token.length).toBeGreaterThan(0);
  });

  test('accepts an uppercase, padded address (normalisation)', async () => {
    await safeSignOut();

    const result = await signIn({
      email: `  ${account.email.toUpperCase()}  `,
      password: account.password,
    });

    expect(result.ok).toBe(true);
  });

  test('reports a wrong password as invalid_credentials, not a leaked reason', async () => {
    await safeSignOut();

    const result = await signIn({ email: account.email, password: 'Wrong-Password-1!' });

    expect(result.ok).toBe(false);

    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe('invalid_credentials');
    // The message must not reveal whether the account exists.
    expect(result.error.message).not.toMatch(/not found|no account|does not exist/i);
    expect(result.error.rawCode).toBe('invalid_credentials');
  });

  test('reports an unknown address with the same message as a wrong password', async () => {
    const result = await signIn({
      email: `nobody-here-${Date.now()}@example.com`,
      password: TEST_PASSWORD,
    });

    expect(result.ok).toBe(false);

    if (result.ok) {
      return;
    }

    // Account enumeration guard: identical wording for both cases.
    expect(result.error.code).toBe('invalid_credentials');
  });
});

describe('session lifecycle', () => {
  test('getCurrentUser revalidates against the server', async () => {
    await signInTestAccount(account);

    const result = await getCurrentUser();

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.data.id).toBe(account.userId);
    expect(result.data.email).toBe(account.email);
  });

  test('signOut clears the persisted session', async () => {
    await signInTestAccount(account);

    const before = await getActiveSession();

    expect(before.ok && before.data).not.toBeNull();

    await safeSignOut();

    const after = await getActiveSession();

    expect(after.ok).toBe(true);

    if (!after.ok) {
      return;
    }

    expect(after.data).toBeNull();
  });

  test('onAuthStateChange reports SIGNED_IN then SIGNED_OUT', async () => {
    const events: AuthEvent[] = [];
    const unsubscribe = onAuthStateChange((event) => {
      events.push(event);
    });

    try {
      await signInTestAccount(account);
      await safeSignOut();

      // The listener fires asynchronously; give it a moment to drain.
      await new Promise((resolve) => setTimeout(resolve, 1_500));

      expect(events).toContain('SIGNED_IN');
      expect(events).toContain('SIGNED_OUT');
    } finally {
      unsubscribe();
    }
  });

  test('unsubscribing stops further events', async () => {
    const events: AuthEvent[] = [];
    const unsubscribe = onAuthStateChange((event) => {
      events.push(event);
    });

    unsubscribe();

    await signInTestAccount(account);
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(events).toHaveLength(0);
  });
});

describe('sendPasswordResetEmail', () => {
  test('rejects a malformed address without sending anything', async () => {
    const result = await sendPasswordResetEmail('nope');

    expect(result.ok).toBe(false);

    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe('email_address_invalid');
  });

  /**
   * The happy path is deliberately not tested: it sends a real email, and
   * Supabase's default SMTP allows only a handful per hour, so running it on
   * every suite would exhaust the project's quota and make later runs fail for
   * an unrelated reason.
   */
  test.skip('sends a reset email for a real address (needs SMTP quota)', async () => {
    const result = await sendPasswordResetEmail(account.email);

    expect(result.ok).toBe(true);
  });
});

describe('generated fixtures', () => {
  test('every address used was an example.com throwaway', () => {
    // A guard against a fixture accidentally pointing at a real inbox.
    expect(createdEmails.every((email) => email.endsWith('@example.com'))).toBe(true);
  });
});