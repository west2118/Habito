export {
  HABIT_ERROR_MESSAGES,
  createHabitError,
  toHabitError,
} from './errors';
export type { HabitError, HabitErrorCode, HabitResult } from './errors';

export {
  archiveHabit,
  createHabit,
  deleteHabit,
  getHabit,
  listHabits,
  unarchiveHabit,
  updateHabit,
} from './habits';

export {
  DEFAULT_HABIT_COLOR,
  MAX_PROMPT_LENGTH,
  MAX_TITLE_LENGTH,
  deriveHabitType,
} from './types';
export type {
  CreateHabitInput,
  Habit,
  HabitSchedule,
  HabitType,
  ProofSource,
  UpdateHabitInput,
} from './types';