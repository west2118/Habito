/**
 * Timezone-aware date helpers.
 *
 * Streaks and "is this habit due today?" are calendar concepts, not clock
 * concepts. A user in Manila logging at 08:00 must land on the same `log_date`
 * as one in London logging at 23:00, so every date is derived in the user's
 * stored IANA timezone rather than the device's UTC offset. Getting this wrong
 * silently shifts streaks by a day, which is exactly the kind of bug that erodes
 * trust in a tracker.
 *
 * The device timezone is only a *guess* for signed-out users; the authoritative
 * value lives in `profiles.timezone`.
 */

/** ISO `YYYY-MM-DD`, the format Postgres `date` columns expect. */
export type IsoDate = string;

/** IANA zone name, e.g. `Asia/Manila`. */
export type TimeZone = string;

/** Fallback when the platform cannot report a timezone. */
export const DEFAULT_TIME_ZONE: TimeZone = 'UTC';

/**
 * Reads the device timezone.
 *
 * `Intl` throws on an unknown zone, and Hermes is not guaranteed to ship a full
 * ICU build, so this degrades to UTC instead of taking the app down.
 */
export const getDeviceTimeZone = (): TimeZone => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIME_ZONE;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
};

/**
 * Returns today's calendar date in `timeZone` as `YYYY-MM-DD`.
 *
 * The `en-CA` locale is the trick: it formats dates as `YYYY-MM-DD`, which is
 * exactly Postgres' `date` text format — no manual padding required.
 */
export const getTodayIsoDate = (timeZone: TimeZone = getDeviceTimeZone(), now = new Date()): IsoDate => {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
  } catch {
    // Unknown zone: fall back to UTC rather than throwing during render.
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: DEFAULT_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
  }
};

/**
 * Days in the week, Monday-first, matching `WeekdayPicker` and the design.
 * `0 = Monday … 6 = Sunday`.
 */
export const DAYS_IN_WEEK = 7;

/** Every valid Monday-first weekday index. */
export const WEEKDAY_INDICES = [0, 1, 2, 3, 4, 5, 6] as const;

export type WeekdayIndex = (typeof WEEKDAY_INDICES)[number];

/**
 * Converts JavaScript's Sunday-first `Date.getDay()` into the app's
 * Monday-first index.
 *
 * `getDay()` returns 0 for Sunday, so shifting by 6 and wrapping with `% 7`
 * rotates the week: Sunday(0) -> 6, Monday(1) -> 0, Saturday(6) -> 5.
 */
export const toMondayFirstIndex = (jsDayOfWeek: number): WeekdayIndex =>
  (((jsDayOfWeek + 6) % DAYS_IN_WEEK) as WeekdayIndex);

/** Monday-first weekday index for a calendar date. */
export const getWeekdayIndex = (isoDate: IsoDate): WeekdayIndex => {
  const parsed = new Date(`${isoDate}T00:00:00Z`);

  return toMondayFirstIndex(parsed.getUTCDay());
};

/**
 * Narrows a plain `number[]` to `WeekdayIndex[]`, dropping anything out of range.
 *
 * `WeekdayPicker` deals in `number[]`, so this is the boundary where UI state
 * becomes domain state. Using a real type guard rather than a cast means an
 * out-of-range value from the UI is dropped instead of being trusted into the
 * database.
 */
export const toWeekdayIndices = (days: readonly number[]): WeekdayIndex[] =>
  days.filter((day): day is WeekdayIndex =>
    (WEEKDAY_INDICES as readonly number[]).includes(day),
  );

/** Parses `YYYY-MM-DD` into a UTC-midnight `Date`, avoiding local-time drift. */
export const parseIsoDate = (isoDate: IsoDate): Date => new Date(`${isoDate}T00:00:00Z`);

/** Formats a `Date` as `YYYY-MM-DD` using its UTC fields. */
export const toIsoDate = (date: Date): IsoDate => date.toISOString().slice(0, 10);

/** Adds `days` to an ISO date and returns a new ISO date. */
export const addDays = (isoDate: IsoDate, days: number): IsoDate => {
  const date = parseIsoDate(isoDate);

  date.setUTCDate(date.getUTCDate() + days);

  return toIsoDate(date);
};

/** Whole days from `from` to `to`; negative when `to` is in the past. */
export const daysBetween = (from: IsoDate, to: IsoDate): number =>
  Math.round((parseIsoDate(to).getTime() - parseIsoDate(from).getTime()) / 86_400_000);

/** True when both dates fall on the same calendar day. */
export const isSameIsoDate = (a: IsoDate, b: IsoDate): boolean => a === b;

/**
 * Formats an ISO date as a short label, e.g. `Fri, Oct 2`.
 *
 * Rendered in the given timezone so the label matches what the user considers
 * "today" rather than the UTC calendar.
 */
export const formatShortDate = (
  isoDate: IsoDate,
  timeZone: TimeZone = getDeviceTimeZone(),
): string => {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(parseIsoDate(isoDate));
  } catch {
    return isoDate;
  }
};

/** Formats an ISO date as `October 2026`, for calendar headers. */
export const formatMonthYear = (isoDate: IsoDate): string => {
  const date = parseIsoDate(isoDate);

  // `en-US` long format is "October 2026"; slice off the day to drop it.
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
    .format(date)
    .replace(/,?\s*\d{1,2}$/, '');
};

/** First day of the month containing `isoDate`, as an ISO date. */
export const startOfMonth = (isoDate: IsoDate): IsoDate => `${isoDate.slice(0, 7)}-01`;

/** Number of days in the month containing `isoDate`. */
export const daysInMonth = (isoDate: IsoDate): number => {
  const date = parseIsoDate(isoDate);

  // Day 0 of the following month is the last day of this one.
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
};