export {
  PROOF_ERROR_MESSAGES,
  createProofError,
  toProofError,
} from './errors';
export type { ProofError, ProofErrorCode, ProofResult } from './errors';

export { completeHabitWithPhoto, getProofSignedUrl, listCompletionDatesByHabit, listDayActivity, listMonthCompletedDates, listTodayCompletions } from './proofs';
export type { DayActivity, ProofLog } from './proofs';
