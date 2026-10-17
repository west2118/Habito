/**
 * Email verification codes — 6-digit OTPs with a 15-minute lifetime.
 *
 * Flow: `signUp` creates an *unconfirmed* account and Supabase emails a
 * 6-digit code; the user types it into the app and `verifySignUpCode` confirms
 * the address and returns the session. Until that succeeds there is no usable
 * account: no session is issued, the route guard keeps the user out, and
 * sign-in is rejected with `email_not_confirmed`.
 *
 * Two things this module cannot do from the client, so they live in the
 * Supabase dashboard (the code comments at `verifySignUpCode` say exactly
 * where):
 * - make Supabase *send* a 6-digit code instead of a link — the "Confirm
 *   signup" email template must render `{{ .Token }}`;
 * - enforce the 15-minute lifetime server-side — the project's OTP expiry
 *   must be 900 seconds. The countdown here is UX (it stops the user typing
 *   a dead code); the server is the real expiry.
 */

/** Digits Supabase puts in the confirmation email. */
export const VERIFICATION_CODE_LENGTH = 6;

/** How long a code stays valid, in minutes. Must match the OTP expiry (900s). */
export const VERIFICATION_CODE_EXPIRY_MINUTES = 15;

/** Same window in milliseconds, for the countdown and expiry checks. */
export const VERIFICATION_CODE_EXPIRY_MS = VERIFICATION_CODE_EXPIRY_MINUTES * 60_000;

/** Cooldown between resends, in seconds (avoids the send-rate limit). */
export const VERIFICATION_RESEND_COOLDOWN_SECONDS = 60;

/** True when `code` is exactly 6 ASCII digits (surrounding spaces allowed). */
export const isVerificationCodeFormatValid = (code: string): boolean =>
  new RegExp(`^\\d{${VERIFICATION_CODE_LENGTH}}$`).test(code.trim());

/** Strips everything but digits and caps at 6 — for live input sanitising. */
export const sanitizeVerificationCodeInput = (value: string): string =>
  value.replace(/\D/g, '').slice(0, VERIFICATION_CODE_LENGTH);

/** True when more than the 15-minute window has passed since `sentAt`. */
export const isVerificationCodeExpired = (sentAt: number, now: number = Date.now()): boolean =>
  now - sentAt >= VERIFICATION_CODE_EXPIRY_MS;

/** Remaining milliseconds in the window, floored at zero. */
export const verificationCodeRemainingMs = (sentAt: number, now: number = Date.now()): number =>
  Math.max(0, VERIFICATION_CODE_EXPIRY_MS - (now - sentAt));

/** `ms` as `M:SS`, e.g. 14:03 — the countdown label. */
export const formatVerificationCountdown = (ms: number): string => {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};
