import { createHabit, deleteHabit } from '@/lib/habits';
import { skipHabitForDay, unskipHabitForDay, listSkippedHabitIds } from '@/lib/skips';
import { getSupabase } from '@/lib/supabase';
import { createTestAccount, type TestAccount } from './helpers/test-account';
import { requireWritableHabitsTable } from './helpers/preflight';
import { getTodayIsoDate } from '@/lib/dates';

jest.setTimeout(60_000);

describe('skipHabitForDay live integration', () => {
  let account: TestAccount;
  let habitId: string;

  beforeAll(async () => {
    account = await createTestAccount('habito-skip-test');
    await requireWritableHabitsTable();

    const created = await createHabit({
      title: 'Skip Test Habit ' + Date.now(),
      icon: 'fitness',
      targetDays: [0, 1, 2, 3, 4, 5, 6],
      photoMandatory: true,
      proofSource: 'camera',
    });

    if (!created.ok) {
      throw new Error(`Could not seed habit: ${created.error.message}`);
    }

    habitId = created.data.id;
  });

  afterAll(async () => {
    if (habitId) {
      await deleteHabit(habitId);
    }
  });

  it('can skip and unskip a habit for today without check constraint violation', async () => {
    const today = getTodayIsoDate();

    // 1. Skip habit
    const skipRes = await skipHabitForDay(habitId, today);
    expect(skipRes.ok).toBe(true);

    // 2. Check skipped
    const listRes = await listSkippedHabitIds([habitId], today);
    expect(listRes.ok).toBe(true);
    if (listRes.ok) {
      expect(listRes.data).toContain(habitId);
    }

    // 3. Unskip habit
    const unskipRes = await unskipHabitForDay(habitId, today);
    expect(unskipRes.ok).toBe(true);

    // 4. Verify no longer skipped
    const listAfterRes = await listSkippedHabitIds([habitId], today);
    expect(listAfterRes.ok).toBe(true);
    if (listAfterRes.ok) {
      expect(listAfterRes.data).not.toContain(habitId);
    }
  });
});
