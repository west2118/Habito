/**
 * Live integration tests proving Row Level Security actually isolates users.
 *
 * This is the most important suite in the repo. The app ships a *publishable*
 * key, which is visible to anyone who unpacks the bundle, so the RLS policies
 * are the only thing standing between one user's habits and another's. A policy
 * that is subtly wrong passes every other test in the suite and leaks data.
 *
 * The test creates two independent throwaway accounts and checks that the second
 * can neither see, modify, nor learn the existence of the first's habit.
 */

import { signIn, signOut } from '@/lib/auth';
import {
  archiveHabit,
  createHabit,
  deleteHabit,
  getHabit,
  listHabits,
  updateHabit,
} from '@/lib/habits';
import type { WeekdayIndex } from '@/lib/dates';
import { createTestAccount, type TestAccount } from './helpers/test-account';
import { requireWritableHabitsTable } from './helpers/preflight';

jest.setTimeout(60_000);

let owner: TestAccount;
let intruder: TestAccount;
let ownerHabitId: string;

const payload = (title: string) => ({
  title,
  icon: 'book' as const,
  targetDays: [0, 1, 2, 3, 4] as WeekdayIndex[],
  photoMandatory: true,
  proofSource: 'camera' as const,
});

beforeAll(async () => {
  owner = await createTestAccount('habito-rls-owner');
  await requireWritableHabitsTable();

  const created = await createHabit(payload('Owner Private Habit'));

  if (!created.ok) {
    throw new Error(`Could not seed the owner's habit: ${created.error.message}`);
  }

  ownerHabitId = created.data.id;

  // Switch identities: sign out, then create a brand new account on the same
  // client. Both accounts and both tokens live in the same secure store, which
  // is exactly the real-world "two people sharing a device" case.
  await signOut();
  intruder = await createTestAccount('habito-rls-intruder');
});

afterAll(async () => {
  // Leave the owner's account signed in so afterAll cleanup can delete the
  // seeded habit; the intruder's rows are not ours to remove.
  await signOut();
});

describe('RLS isolation', () => {
  test('the intruder cannot list the owner habits', async () => {
    const result = await listHabits({ includeArchived: true });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.data.some((habit) => habit.id === ownerHabitId)).toBe(false);
    expect(result.data.every((habit) => habit.user_id === intruder.userId)).toBe(true);
  });

  test('reading the owner habit id returns null, not the row', async () => {
    const result = await getHabit(ownerHabitId);

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    // RLS filters the row out, so it is indistinguishable from a bad id. The
    // function must not leak the row's contents, nor confirm it exists.
    expect(result.data).toBeNull();
  });

  test('the intruder cannot rename the owner habit', async () => {
    const result = await updateHabit(ownerHabitId, { title: 'Hijacked' });

    // Either an RLS denial or an update that matched no row both end in failure.
    expect(result.ok).toBe(false);

    if (result.ok) {
      return;
    }

    expect(result.error.message.length).toBeGreaterThan(0);
  });

  test('the intruder cannot archive the owner habit', async () => {
    const result = await archiveHabit(ownerHabitId);

    expect(result.ok).toBe(false);
  });

  test('the owner habit is intact after the intrusion attempts', async () => {
    // Re-authenticate as the owner and confirm nothing was modified.
    await signIn({ email: owner.email, password: owner.password });

    const result = await getHabit(ownerHabitId);

    expect(result.ok).toBe(true);

    if (!result.ok || result.data === null) {
      return;
    }

    expect(result.data.title).toBe('Owner Private Habit');
    expect(result.data.is_archived).toBe(false);
    expect(result.data.user_id).toBe(owner.userId);
  });

  test('cleanup removes the seeded habit', async () => {
    const result = await deleteHabit(ownerHabitId);

    expect(result.ok).toBe(true);
  });
});