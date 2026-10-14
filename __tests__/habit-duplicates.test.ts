/**
 * Duplicate-creation probe for the habits API.
 *
 * Reproduces the "preset habit created twice" report against the live project:
 * 1. sequential repeat — creating the same title twice must leave one row;
 * 2. concurrent race — two simultaneous creates with the same title must also
 *    leave one row. Note this exercises the *client* creation queue
 *    (`runExclusive`), which serialises creates inside one runtime, so it
 *    passes even when the database enforces nothing;
 * 3. database enforcement — a duplicate inserted straight through PostgREST,
 *    bypassing the client guard entirely, must be rejected. Only this one
 *    proves the guarantee holds across devices, which is what the app relies
 *    on. It fails until
 *    `supabase/migrations/20261009120006_habit_title_unique_repair.sql` has
 *    been applied.
 */

import { createHabit, deleteHabit, listHabits, newHabitIdempotencyKey } from '@/lib/habits';
import { getSupabase } from '@/lib/supabase';
import type { WeekdayIndex } from '@/lib/dates';
import { cleanupTestHabits, createTestAccount } from './helpers/test-account';

jest.setTimeout(60_000);

const input = (title: string) => ({
  title,
  icon: 'bed',
  targetDays: [0, 1, 2, 3, 4, 5, 6] as WeekdayIndex[],
  photoMandatory: true as const,
  proofSource: 'camera' as const,
  idempotencyKey: newHabitIdempotencyKey(),
});

const countByTitle = async (title: string): Promise<number> => {
  const listed = await listHabits({ includeArchived: true });

  expect(listed.ok).toBe(true);

  if (!listed.ok) {
    return -1;
  }

  return listed.data.filter((habit) => habit.title === title).length;
};

beforeAll(async () => {
  await createTestAccount('habito-dupe-probe');

  // Inline preflight (no dynamic import): the shared helper crashes under
  // babel-jest CJS, which already fails every other integration suite.
  const probe = await createHabit(input('Preflight Check'));

  if (!probe.ok) {
    throw new Error(
      `The habits table is not writable from the test account: ${probe.error.message} ` +
        `(code: ${probe.error.code}, raw: ${probe.error.rawCode ?? 'none'}).`,
    );
  }

  await deleteHabit(probe.data.id);
});

afterAll(async () => {
  await cleanupTestHabits();
});

test('sequential repeat title leaves exactly one row', async () => {
  const title = `Dupe Probe ${Date.now()}`;

  const first = await createHabit(input(title));
  expect(first.ok).toBe(true);

  const second = await createHabit(input(title));
  expect(second.ok).toBe(false);

  expect(await countByTitle(title)).toBe(1);
});

test('concurrent double-create with the same title leaves exactly one row', async () => {
  const title = `Race Probe ${Date.now()}`;

  await Promise.allSettled([createHabit(input(title)), createHabit(input(title))]);

  expect(await countByTitle(title)).toBe(1);
});

test('the database itself rejects a duplicate title', async () => {
  const supabase = await getSupabase();
  const me = await supabase.auth.getUser();
  const userId = me.data.user?.id;

  expect(userId).toBeTruthy();

  const title = `Index Probe ${Date.now()}`;
  const row = {
    user_id: userId,
    title,
    icon: 'bed',
    color: '#E1121F',
    type: 'daily',
    schedule: { target_days: [0, 1, 2, 3, 4, 5, 6] },
    photo_mandatory: true,
    proof_source: 'camera',
  };

  const first = await supabase.from('habits').insert(row).select('id').single();

  expect(first.error).toBeNull();

  const second = await supabase.from('habits').insert(row).select('id').single();

  // Clean up before asserting, so a failure here never leaves probe rows behind.
  await supabase.from('habits').delete().eq('title', title);

  if (second.error === null) {
    throw new Error(
      'The database accepted a duplicate habit title, so the `habits_user_title_unique` ' +
        'index is missing — this is what lets the same habit be created twice across two ' +
        'app instances. Apply ' +
        '`supabase/migrations/20261009120006_habit_title_unique_repair.sql`, which clears ' +
        'the existing duplicates and then creates the index.',
    );
  }

  expect(second.error.code).toBe('23505');
  expect(`${second.error.message} ${second.error.details}`).toContain('habits_user_title_unique');
});
