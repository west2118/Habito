/**
 * Live integration tests for the habits API.
 *
 * These write real rows to the `habits` table in the project configured in
 * `.env`, so they verify the schema, the CHECK constraints and the RLS
 * policies together — the exact things a mocked client cannot vouch for, and the
 * things that broke last time `proof_source` was missing.
 *
 * `afterAll` deletes every habit belonging to the throwaway account. The
 * `auth.users` row itself cannot be removed without the `service_role` key.
 */

import {
  archiveHabit,
  createHabit,
  deleteHabit,
  getHabit,
  listHabits,
  unarchiveHabit,
  updateHabit,
  DEFAULT_HABIT_COLOR,
} from '@/lib/habits';
import type { WeekdayIndex } from '@/lib/dates';
import { cleanupTestHabits, createTestAccount, type TestAccount } from './helpers/test-account';
import { requireWritableHabitsTable } from './helpers/preflight';

jest.setTimeout(60_000);

let account: TestAccount;

/** Builds a valid payload; individual tests override a single field. */
const payload = (overrides: Partial<Parameters<typeof createHabit>[0]> = {}) => ({
  title: 'Morning Run',
  icon: 'walk',
  targetDays: [0, 2, 4] as WeekdayIndex[],
  photoMandatory: true,
  photoPrompt: 'Photo of your trainers',
  proofSource: 'camera' as const,
  ...overrides,
});

beforeAll(async () => {
  account = await createTestAccount('habito-habits');
  // Fail once, loudly, if the live schema disagrees with the app.
  await requireWritableHabitsTable();
});

afterAll(async () => {
  await cleanupTestHabits();
});

describe('createHabit', () => {
  test('persists every field the New habit form collects', async () => {
    const result = await createHabit(payload({ title: 'Read 20 Pages' }));

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    const habit = result.data;

    expect(habit.id).toEqual(expect.any(String));
    expect(habit.user_id).toBe(account.userId);
    expect(habit.title).toBe('Read 20 Pages');
    expect(habit.icon).toBe('walk');
    expect(habit.photo_prompt).toBe('Photo of your trainers');
    expect(habit.photo_mandatory).toBe(true);
    // The column added after the spec; fails loudly if schema.sql was not run.
    expect(habit.proof_source).toBe('camera');
  });

  test('applies database-owned defaults the client never sends', async () => {
    const result = await createHabit(payload({ title: 'Defaults Check' }));

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.data.streak_current).toBe(0);
    expect(result.data.streak_longest).toBe(0);
    expect(result.data.is_archived).toBe(false);
    expect(result.data.color).toBe(DEFAULT_HABIT_COLOR);
    expect(result.data.created_at).toEqual(expect.any(String));
  });

  test('round-trips the schedule jsonb', async () => {
    const result = await createHabit(payload({ title: 'Schedule Check', targetDays: [1, 3, 5] }));

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    // PostgREST returns jsonb parsed, not as a string.
    expect(result.data.schedule).toEqual({ target_days: [1, 3, 5] });
  });

  test('derives type "weekly" for a subset of days', async () => {
    const result = await createHabit(payload({ title: 'Subset', targetDays: [0, 2, 4] }));

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.data.type).toBe('weekly');
  });

  test('derives type "daily" when all seven days are selected', async () => {
    const result = await createHabit(
      payload({ title: 'Every Day', targetDays: [0, 1, 2, 3, 4, 5, 6] }),
    );

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.data.type).toBe('daily');
  });

  test('deduplicates and sorts the schedule', async () => {
    const result = await createHabit(payload({ title: 'Messy Days', targetDays: [4, 0, 4, 2] }));

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.data.schedule.target_days).toEqual([0, 2, 4]);
    expect(result.data.type).toBe('weekly');
  });

  test('trims whitespace and stores an empty prompt as null', async () => {
    const result = await createHabit(payload({ title: '   Trimmed   ', photoPrompt: '   ' }));

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.data.title).toBe('Trimmed');
    expect(result.data.photo_prompt).toBeNull();
  });

  test('rejects a blank title without writing a row', async () => {
    const result = await createHabit(payload({ title: '   ' }));

    expect(result.ok).toBe(false);

    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe('validation_failed');
  });

  test('rejects a title over the length limit', async () => {
    const result = await createHabit(payload({ title: 'x'.repeat(61) }));

    expect(result.ok).toBe(false);

    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe('validation_failed');
  });

  test('rejects an empty schedule', async () => {
    const result = await createHabit(payload({ title: 'No Days', targetDays: [] }));

    expect(result.ok).toBe(false);

    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe('validation_failed');
  });
});

describe('listHabits and getHabit', () => {
  test('lists the active habits newest first', async () => {
    const first = await createHabit(payload({ title: 'First Habit' }));
    const second = await createHabit(payload({ title: 'Second Habit' }));

    expect(first.ok && second.ok).toBe(true);

    if (!first.ok || !second.ok) {
      return;
    }

    const result = await listHabits();

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    const ids = result.data.map((habit) => habit.id);

    expect(ids).toContain(first.data.id);
    expect(ids).toContain(second.data.id);
    // created_at desc: the later insert comes first.
    expect(ids.indexOf(second.data.id)).toBeLessThan(ids.indexOf(first.data.id));
  });

  test('every listed habit belongs to the signed-in user', async () => {
    const result = await listHabits({ includeArchived: true });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    // Proves RLS is doing its job: nothing from another account is visible.
    expect(result.data.every((habit) => habit.user_id === account.userId)).toBe(true);
  });

  test('getHabit reads one habit by id', async () => {
    const created = await createHabit(payload({ title: 'Readable' }));

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const result = await getHabit(created.data.id);

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.data?.id).toBe(created.data.id);
    expect(result.data?.title).toBe('Readable');
  });

  test('getHabit returns null for an unknown id', async () => {
    const result = await getHabit('00000000-0000-0000-0000-000000000000');

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.data).toBeNull();
  });
});

describe('updateHabit', () => {
  test('changes only the supplied fields', async () => {
    const created = await createHabit(payload({ title: 'Before', photoPrompt: 'Keep me' }));

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const result = await updateHabit(created.data.id, { title: 'After' });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.data.title).toBe('After');
    // The point of the partial-update design: an omitted key is left alone.
    expect(result.data.photo_prompt).toBe('Keep me');
    expect(result.data.proof_source).toBe(created.data.proof_source);
    expect(result.data.schedule).toEqual(created.data.schedule);
    expect(result.data.id).toBe(created.data.id);
  });

  test('re-derives type when the schedule changes', async () => {
    const created = await createHabit(payload({ title: 'Recalc', targetDays: [0, 1, 2] }));

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    expect(created.data.type).toBe('weekly');

    const result = await updateHabit(created.data.id, { targetDays: [0, 1, 2, 3, 4, 5, 6] });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.data.type).toBe('daily');
    expect(result.data.schedule.target_days).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  test('clears a prompt when given an empty string', async () => {
    const created = await createHabit(payload({ title: 'Clear Prompt', photoPrompt: 'Something' }));

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const result = await updateHabit(created.data.id, { photoPrompt: '' });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.data.photo_prompt).toBeNull();
  });

  test('rejects clearing the title', async () => {
    const created = await createHabit(payload({ title: 'Protected' }));

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const result = await updateHabit(created.data.id, { title: '  ' });

    expect(result.ok).toBe(false);

    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe('validation_failed');

    // Confirm the row was genuinely untouched.
    const reread = await getHabit(created.data.id);

    expect(reread.ok && reread.data?.title).toBe('Protected');
  });

  test('rejects an empty schedule', async () => {
    const created = await createHabit(payload({ title: 'Keeps Days' }));

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const result = await updateHabit(created.data.id, { targetDays: [] });

    expect(result.ok).toBe(false);

    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe('validation_failed');
  });
});

describe('archiving', () => {
  test('hides an archived habit but keeps it retrievable', async () => {
    const created = await createHabit(payload({ title: 'Archivable' }));

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const archived = await archiveHabit(created.data.id);

    expect(archived.ok).toBe(true);

    if (!archived.ok) {
      return;
    }

    expect(archived.data.is_archived).toBe(true);

    // Soft delete: excluded from the default list...
    const active = await listHabits();

    expect(active.ok && active.data.some((h) => h.id === created.data.id)).toBe(false);

    // ...but still present when explicitly requested, preserving history.
    const all = await listHabits({ includeArchived: true });

    expect(all.ok && all.data.some((h) => h.id === created.data.id)).toBe(true);
  });

  test('unarchiveHabit restores it to the active list', async () => {
    const created = await createHabit(payload({ title: 'Restorable' }));

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    await archiveHabit(created.data.id);

    const restored = await unarchiveHabit(created.data.id);

    expect(restored.ok).toBe(true);

    if (!restored.ok) {
      return;
    }

    expect(restored.data.is_archived).toBe(false);

    const active = await listHabits();

    expect(active.ok && active.data.some((h) => h.id === created.data.id)).toBe(true);
  });
});

describe('deleteHabit', () => {
  test('removes the row permanently', async () => {
    const created = await createHabit(payload({ title: 'Doomed' }));

    expect(created.ok).toBe(true);

    if (!created.ok) {
      return;
    }

    const result = await deleteHabit(created.data.id);

    expect(result.ok).toBe(true);

    const reread = await getHabit(created.data.id);

    expect(reread.ok && reread.data).toBeNull();
  });
});