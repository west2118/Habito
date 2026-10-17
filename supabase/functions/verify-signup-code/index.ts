/**
 * `verify-signup-code` — step 2 of gated sign-up.
 *
 * Body: `{ email: string, code: string, password: string, fullName?: string }`.
 *
 * Checks the 6-digit code against `pending_signups` (hash-compared, 15-minute
 * expiry, 5 wrong attempts voids the code) and ONLY then creates the auth
 * user via the Admin API with `email_confirm: true`. A wrong code, an expired
 * code, or an abandoned flow creates nothing: no `auth.users` row, no profile,
 * and that email can never sign in because it was never registered.
 *
 * The password travels here once, over HTTPS, and is never stored — it is
 * handed straight to `admin.createUser` and then dropped.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import {
  fail,
  hashCode,
  MAX_ATTEMPTS,
  normalizeEmail,
  ok,
  optionsResponse,
  timingSafeEqual,
  type PendingSignupRow,
} from '../_shared/signup-code.ts';

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 72;

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return optionsResponse();
  if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST.');

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return fail(400, 'invalid_request', 'Send a JSON body with the code.');
  }

  const email = normalizeEmail(body.email);
  if (!email) {
    return fail(400, 'invalid_email', 'That does not look like a valid email address.');
  }

  const code = typeof body.code === 'string' ? body.code.trim() : '';
  if (!/^\d{6}$/.test(code)) {
    return fail(400, 'code_invalid', 'Enter the 6-digit code from your email.');
  }

  const password = typeof body.password === 'string' ? body.password : '';
  if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    return fail(400, 'weak_password', 'Your password needs to be 8–72 characters long.');
  }

  const fullName =
    typeof body.fullName === 'string' && body.fullName.trim().length > 0
      ? body.fullName.trim().slice(0, 80)
      : null;

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[verify-signup-code] missing secrets');
    return fail(500, 'not_configured', 'Account verification is not set up yet. Try again later.');
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: pending } = await supabase
    .from('pending_signups')
    .select('email, full_name, code_hash, expires_at, attempts')
    .eq('email', email)
    .maybeSingle<Pick<PendingSignupRow, 'email' | 'full_name' | 'code_hash' | 'expires_at' | 'attempts'>>();

  // No row: never requested, already consumed, or voided after too many tries.
  if (!pending) {
    return fail(404, 'no_pending_code', 'No active code for that email. Request a new one.');
  }

  if (Date.now() >= new Date(pending.expires_at).getTime()) {
    await supabase.from('pending_signups').delete().eq('email', email);
    return fail(410, 'code_expired', 'That code expired after 15 minutes. Request a new one.');
  }

  if (pending.attempts >= MAX_ATTEMPTS) {
    await supabase.from('pending_signups').delete().eq('email', email);
    return fail(429, 'too_many_attempts', 'Too many wrong attempts. Request a new code.');
  }

  const pepper = Deno.env.get('CODE_PEPPER') ?? serviceRoleKey;
  const matches = timingSafeEqual(await hashCode(code, pepper), pending.code_hash);

  if (!matches) {
    await supabase
      .from('pending_signups')
      .update({ attempts: pending.attempts + 1 })
      .eq('email', email);
    return fail(400, 'code_invalid', 'That code is incorrect. Check the digits and try again.');
  }

  // The code is good: this is the ONLY place the account comes into existence.
  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName ?? pending.full_name },
  });

  if (createError) {
    const haystack = `${createError.code ?? ''} ${createError.message}`.toLowerCase();
    // The address was registered between the code request and now (or was
    // always registered): void the code and say so.
    if (haystack.includes('already') || haystack.includes('exists')) {
      await supabase.from('pending_signups').delete().eq('email', email);
      return fail(409, 'email_exists', 'An account with that email already exists. Sign in instead.');
    }

    console.error('[verify-signup-code] createUser failed:', createError.message);
    // Keep the row (attempts untouched — the code itself was right) so a
    // transient failure does not burn a correct code.
    if (haystack.includes('password')) {
      return fail(400, 'weak_password', 'Choose a stronger password — at least 8 characters.');
    }

    return fail(500, 'unknown', 'The account could not be created. Please try again.');
  }

  // Single-use: the code dies with the verification that consumed it.
  await supabase.from('pending_signups').delete().eq('email', email);

  return ok({ ok: true, user_id: created.user?.id ?? null });
});
