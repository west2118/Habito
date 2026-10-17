/**
 * `request-signup-code` — step 1 of gated sign-up.
 *
 * Body: `{ email: string, fullName?: string }`.
 *
 * Stores a hashed 6-digit code in `pending_signups` (15-minute expiry) and
 * emails it. Creates NOTHING in `auth.users`: a user who never completes step
 * 2 has no account and can never sign in with that email.
 *
 * Always answers 200 on a sent code; throttled or invalid requests get
 * 400/429 with a `{ code, message }` payload the app maps to its AuthErrors.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import {
  CODE_TTL_MS,
  fail,
  generateCode,
  hashCode,
  MAX_SENDS_PER_HOUR,
  normalizeEmail,
  ok,
  optionsResponse,
  RESEND_COOLDOWN_MS,
  sendCodeEmail,
  type PendingSignupRow,
} from '../_shared/signup-code.ts';

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return optionsResponse();
  if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST.');

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return fail(400, 'invalid_request', 'Send a JSON body with your email.');
  }

  const email = normalizeEmail(body.email);
  if (!email) {
    return fail(400, 'invalid_email', 'That does not look like a valid email address.');
  }

  const fullName =
    typeof body.fullName === 'string' && body.fullName.trim().length > 0
      ? body.fullName.trim().slice(0, 80)
      : null;

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? '';
  const fromEmail = Deno.env.get('SIGNUP_FROM_EMAIL') ?? '';

  if (!supabaseUrl || !serviceRoleKey || !resendApiKey || !fromEmail) {
    console.error('[request-signup-code] missing secrets');
    return fail(500, 'not_configured', 'Account verification is not set up yet. Try again later.');
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const now = Date.now();

  const { data: existing } = await supabase
    .from('pending_signups')
    .select('last_sent_at, send_count, created_at')
    .eq('email', email)
    .maybeSingle<Pick<PendingSignupRow, 'last_sent_at' | 'send_count' | 'created_at'>>();

  if (existing) {
    if (now - new Date(existing.last_sent_at).getTime() < RESEND_COOLDOWN_MS) {
      return fail(429, 'rate_limited', 'A code was just sent. Wait a minute before retrying.');
    }

    const withinHour = now - new Date(existing.created_at).getTime() < 3_600_000;
    if (withinHour && existing.send_count >= MAX_SENDS_PER_HOUR) {
      return fail(429, 'rate_limited', 'Too many codes sent. Try again in an hour.');
    }
  }

  const code = generateCode();
  const pepper = Deno.env.get('CODE_PEPPER') ?? serviceRoleKey;
  const codeHash = await hashCode(code, pepper);
  const expiresAt = new Date(now + CODE_TTL_MS).toISOString();
  const sendCount =
    existing && now - new Date(existing.created_at).getTime() < 3_600_000
      ? existing.send_count + 1
      : 1;

  // One active code per email: a new request replaces the old code and
  // restarts the 15-minute window (and the attempt counter with it).
  const { error: upsertError } = await supabase.from('pending_signups').upsert(
    {
      email,
      full_name: fullName,
      code_hash: codeHash,
      expires_at: expiresAt,
      attempts: 0,
      send_count: sendCount,
      last_sent_at: new Date(now).toISOString(),
    },
    { onConflict: 'email' },
  );

  if (upsertError) {
    console.error('[request-signup-code] upsert failed:', upsertError.message);
    return fail(500, 'unknown', 'Something went wrong. Please try again.');
  }

  const sent = await sendCodeEmail({ to: email, code, resendApiKey, fromEmail });

  if (!sent) {
    console.error('[request-signup-code] email send failed for:', email);
    return fail(502, 'send_failed', 'The code email could not be sent. Try again.');
  }

  return ok({ ok: true });
});
