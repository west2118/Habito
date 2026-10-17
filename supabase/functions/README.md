# Gated sign-up Edge Functions

`request-signup-code` + `verify-signup-code` implement the guarantee **no
account exists until its email code verifies**:

1. The app calls `request-signup-code` with the email. It stores a *hashed*
   6-digit code in `pending_signups` (15-minute expiry) and emails it.
   No `auth.users` row, no profile — nothing usable.
2. The user types the code. The app calls `verify-signup-code` with the
   email, code, and password. Only a correct, in-window code creates the user
   via the Admin API (`email_confirm: true`); the pending row is deleted.
3. Wrong code / expired code / abandoned flow ⇒ nothing is created, and that
   email can never sign in because it was never registered.

Shared code lives in `_shared/signup-code.ts` (code generation, hashing,
Resend sender, CORS).

## One-time setup

1. **Resend (sends the code emails)** — free tier is enough to start:
   - Create an account at https://resend.com, verify a sending domain
     (or use their onboarding sender while testing).
   - Create an API key.

2. **Function secrets** (never commit these):

   ```bash
   supabase secrets set RESEND_API_KEY=re_xxx SIGNUP_FROM_EMAIL="Habito <no-reply@yourdomain.com>"
   # Optional: separate pepper for code hashes (defaults to the service-role key)
   supabase secrets set CODE_PEPPER=$(openssl rand -hex 32)
   ```

3. **Push the database migration** (creates `pending_signups`):

   ```bash
   supabase db push
   ```

   Or run `supabase/migrations/20261009120008_pending_signups.sql` in
   Dashboard → SQL Editor.

4. **Deploy the functions**:

   ```bash
   supabase functions deploy request-signup-code
   supabase functions deploy verify-signup-code
   ```

## Verifying it works

1. In the app: create an account → a 6-digit code arrives → enter a *wrong*
   code: the account must not exist (sign-in with that email fails with
   "does not match an account").
2. Wait 15 minutes (or request, then check `pending_signups.expires_at`),
   enter the now-expired code: rejected, nothing created.
3. Enter the correct code in time: account created and signed straight in;
   the `pending_signups` row is gone.

## Notes

- Accounts created *before* this flow (unconfirmed Supabase OTP rows) still
  verify through the legacy `verifyOtp` path on the sign-in screen.
- The functions answer errors as `{ code, message }`; the app maps them in
  `src/lib/auth/gated-signup.ts` (`mapFunctionErrorPayload`).
- Rate limits: 60s between sends, 5 sends/hour, 5 wrong attempts per code —
  all enforced server-side in the functions, not just in the UI.
