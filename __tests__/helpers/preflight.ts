/**
 * Preflight checks for the live integration suites.
 *
 * These tests run against the real project, so a mismatch between the app code
 * and the live schema shows up as a wall of near-identical failures. Probing
 * once, up front, turns that into a single actionable message.
 */

import { createHabit } from '@/lib/habits';
import type { WeekdayIndex } from '@/lib/dates';

/**
 * Confirms a habit can actually be written, and explains precisely why not.
 *
 * Worth its own step: the first version of this suite produced 24 failures that
 * all said `violates check constraint "habits_type_check"`, which looks like an
 * app bug but was a stale database constraint.
 */
export const requireWritableHabitsTable = async (): Promise<void> => {
  const probe = await createHabit({
    title: 'Preflight Check',
    icon: 'flask',
    targetDays: [0] as WeekdayIndex[],
    photoMandatory: true,
    proofSource: 'camera',
  });

  if (probe.ok) {
    // Keep the probe row out of the dataset.
    const { deleteHabit } = await import('@/lib/habits');
    await deleteHabit(probe.data.id);
    return;
  }

  const { rawCode, code, message } = probe.error;

  if (rawCode === '23514') {
    throw new Error(
      [
        'The live `habits` table rejected a row that the app considers valid.',
        '',
        `Postgres said: ${message}`,
        '',
        'A CHECK constraint on this table disagrees with `src/lib/habits/types.ts`.',
        'A constraint of the same name may predate `supabase/schema.sql` and be',
        'shadowing the definition in it — the schema guards each constraint with',
        '`if not exists`, so an existing one is never replaced.',
        '',
        'Inspect what is actually enforced, then realign one side with the other:',
        '',
        '  select pg_get_constraintdef(oid), convalidated',
        '    from pg_constraint',
        '   where conname like \'habits%check\';',
        '',
        'and to drop the stale one before re-running the schema:',
        '',
        '  alter table public.habits drop constraint if exists habits_type_check;',
        '',
        `Re-run supabase/schema.sql afterwards. (app error code: ${code})`,
      ].join('\n'),
    );
  }

  throw new Error(
    `The habits table is not writable from the test account: ${message} (code: ${code}, raw: ${rawCode ?? 'none'}).`,
  );
};