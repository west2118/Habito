/**
 * Shared helpers for the gated sign-up Edge Functions.
 *
 * `request-signup-code` stores a hashed 6-digit code in `pending_signups`
 * (15-minute expiry) and emails it; `verify-signup-code` checks the code and
 * only then creates the auth user. Nothing in `auth.users` exists before the
 * code verifies, so a failed or abandoned verification leaves no account and
 * that email can never sign in.
 *
 * Secrets (set with `supabase secrets set` — see `supabase/functions/README.md`):
 * - `RESEND_API_KEY` / `SIGNUP_FROM_EMAIL` — sending the code email.
 * - `CODE_PEPPER` (optional) — hashed into stored codes; falls back to the
 *   service-role key, which is equally secret to everyone but Supabase.
 */

export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** 6-digit numeric codes, matching the app's `VERIFICATION_CODE_LENGTH`. */
export const CODE_LENGTH = 6;

/** Code lifetime, matching the app's 15-minute countdown. */
export const CODE_TTL_MS = 15 * 60_000;

/** Wrong-code submissions allowed per code before it is voided. */
export const MAX_ATTEMPTS = 5;

/** Minimum gap between two code emails to the same address. */
export const RESEND_COOLDOWN_MS = 60_000;

/** Code emails per address per rolling hour. */
export const MAX_SENDS_PER_HOUR = 5;

export const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });

export const ok = (body: unknown): Response => json(200, body);

export const fail = (status: number, code: string, message: string): Response =>
  json(status, { code, message });

export const optionsResponse = (): Response => new Response('ok', { headers: CORS_HEADERS });

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Lowercase-trimmed address, or null when it is not an email at all. */
export const normalizeEmail = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return EMAIL_PATTERN.test(email) ? email : null;
};

/** Cryptographically random zero-padded 6-digit code. */
export const generateCode = (): string => {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(100000 + (buf[0] % 900000));
};

const sha256Hex = async (input: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
};

/** Hash stored in `pending_signups.code_hash` — the raw code never persists. */
export const hashCode = (code: string, pepper: string): Promise<string> =>
  sha256Hex(`${pepper}:${code}`);

/** Length-then-content compare without an early exit on first mismatch. */
export const timingSafeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

export type PendingSignupRow = {
  email: string;
  full_name: string | null;
  code_hash: string;
  expires_at: string;
  attempts: number;
  send_count: number;
  last_sent_at: string;
  created_at: string;
};

/** Sends the code email through Resend. Returns false when it did not go out. */
export const sendCodeEmail = async (args: {
  to: string;
  code: string;
  resendApiKey: string;
  fromEmail: string;
}): Promise<boolean> => {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${args.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: args.fromEmail,
        to: [args.to],
        subject: 'Your Habito verification code',
        text:
          `Your Habito verification code is ${args.code}.\n\n` +
          'Enter it in the app within 15 minutes to activate your account. ' +
          'If you did not request this, ignore this email — no account will be created.',
        html:
          `<p>Your Habito verification code is <strong style="font-size: 20px; letter-spacing: 4px;">${args.code}</strong>.</p>` +
          '<p>Enter it in the app within 15 minutes to activate your account. ' +
          'If you did not request this, ignore this email — no account will be created.</p>',
      }),
    });

    return response.ok;
  } catch {
    return false;
  }
};
