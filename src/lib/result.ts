/**
 * A tiny result type shared by every API module.
 *
 * Functions in this app return a result instead of throwing. That makes a
 * failure a value the caller must handle, so a forgotten `catch` can never
 * become an unhandled promise rejection — which in React Native shows up as a
 * silent dead button rather than a crash.
 *
 * Pair it with a module-specific error type:
 *
 * @example
 * type HabitError = { code: 'validation_failed'; message: string };
 * type HabitResult<T> = Result<T, HabitError>;
 */

/** Exactly one of the two branches is present. */
export type Result<T, E> =
  | { ok: true; data: T }
  | { ok: false; error: E };

/** Wraps a value as a success. */
export const ok = <T, E = never>(data: T): Result<T, E> => ({ ok: true, data });

/** Wraps an error as a failure. */
export const fail = <E, T = never>(error: E): Result<T, E> => ({ ok: false, error });