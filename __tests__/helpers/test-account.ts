/**
 * Helpers for the live integration suites.
 *
 * These tests talk to the real Supabase project configured in `.env` — there is
 * no fake backend. A throwaway account is created per test file and its habits
 * are deleted afterwards.
 *
 * Note on what is *not* cleaned up: the `auth.users` row itself. Deleting it
 * requires the `service_role` key via the admin API, and this app deliberately
 * only ever ships the publishable key. Leftover `habito-test-*` accounts are
 * therefore expected in the Supabase dashboard after a run.
 */

import { signIn, signOut, signUp } from '@/lib/auth';
import { deleteHabit, listHabits } from '@/lib/habits';

/**
 * Password for every throwaway account.
 *
 * Deliberately mixed-case with a symbol and comfortably over the 8-character
 * minimum, so a failure here means a real password-policy change rather than a
 * test artefact.
 */
export const TEST_PASSWORD = 'Habito-Probe-7Qm2x!';

/** Domain used for throwaway addresses. Never delivers — `example.com` is reserved. */
const TEST_EMAIL_DOMAIN = 'example.com';

let sequence = 0;

/**
 * Builds an address that cannot collide with a previous run.
 *
 * The timestamp alone would collide when two suites create accounts within the
 * same millisecond, hence the counter.
 */
export const uniqueTestEmail = (label = 'habito-test'): string => {
  sequence += 1;

  return `${label}-${Date.now()}-${sequence}@${TEST_EMAIL_DOMAIN}`;
};

export type TestAccount = {
  email: string;
  password: string;
  userId: string;
};

/**
 * Creates a signed-in throwaway account.
 *
 * Throws when the Supabase project has email confirmation enabled, because
 * `signUp` then returns no session and every authenticated assertion would fail
 * for a reason that has nothing to do with the code under test. Failing here
 * with an actionable message beats 30 confusing failures downstream.
 */
export const createTestAccount = async (label?: string): Promise<TestAccount> => {
  const email = uniqueTestEmail(label);
  const password = TEST_PASSWORD;

  const result = await signUp({ email, password });

  if (!result.ok) {
    throw new Error(
      `Could not create a test account (${result.error.code}: ${result.error.message}). ` +
        `rawCode=${result.error.rawCode ?? 'none'} — is the Supabase project reachable?`,
    );
  }

  if (result.data.needsEmailConfirmation) {
    throw new Error(
      'This Supabase project requires email confirmation, so the test account has no session.\n' +
        'Turn it off to run the integration tests: Supabase Dashboard -> Authentication -> ' +
        'Sign In / Providers -> Email -> uncheck "Confirm email".\n' +
        'Leave it on for production and disable it again once the suite has passed.',
    );
  }

  return { email, password, userId: result.data.user.id };
};

/** Signs in an existing test account. */
export const signInTestAccount = async (account: TestAccount): Promise<void> => {
  const result = await signIn({ email: account.email, password: account.password });

  if (!result.ok) {
    throw new Error(`Could not sign the test account back in: ${result.error.message}`);
  }
};

/**
 * Deletes every habit belonging to the current user.
 *
 * Best-effort: a failure here is reported but must not mask the test results,
 * because RLS means a throwaway user can only ever delete their own rows.
 */
export const cleanupTestHabits = async (): Promise<void> => {
  const listed = await listHabits({ includeArchived: true });

  if (!listed.ok) {
    throw new Error(`Could not list habits for cleanup: ${listed.error.message}`);
  }

  const results = await Promise.allSettled(listed.data.map((habit) => deleteHabit(habit.id)));

  const failed = results.filter((result) => result.status === 'rejected');

  if (failed.length > 0) {
    throw new Error(`${failed.length} test habit(s) could not be deleted; clean them up manually.`);
  }
};

/** Signs the current user out, ignoring the outcome (used in `afterAll`). */
export const safeSignOut = async (): Promise<void> => {
  await signOut();
};