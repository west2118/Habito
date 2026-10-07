/**
 * Typed access to the Supabase connection settings.
 *
 * Two things matter here:
 *
 * 1. Expo's bundler performs a *static* substitution of `process.env.EXPO_PUBLIC_*`.
 *    Each variable must therefore be referenced with literal dot notation on a
 *    `process.env` member expression — destructuring (`const { FOO } = process.env`),
 *    bracket access (`process.env['FOO']`) or computed keys are NOT inlined and
 *    would resolve to `undefined` on device. The `requireEnv` calls below receive
 *    the value already read by that substitution.
 *
 * 2. Failing loudly at startup beats failing mysteriously later. A missing key
 *    means every request 401s, so we validate once, here, and surface an
 *    actionable message instead of letting `undefined` reach the Supabase client.
 */

/** Environment variables the app expects to be present. */
export type EnvKey =
  | 'EXPO_PUBLIC_SUPABASE_URL'
  | 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY';

/** Settings guaranteed to be present once this module has loaded. */
export type Env = {
  supabaseUrl: string;
  supabasePublishableKey: string;
};

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** Guards against the copy-paste mistakes that produce confusing 401s later. */
const isNonEmptyString = (value: string | undefined): value is string =>
  typeof value === 'string' && value.trim().length > 0;

/**
 * Reads a required variable, throwing a message that names the exact missing key
 * and the file it belongs in. Throwing at module scope means a misconfigured
 * build fails at import time rather than on the first network call.
 */
const requireEnv = (key: EnvKey, value: string | undefined): string => {
  if (!isNonEmptyString(value)) {
    throw new Error(
      `[Habito] Missing environment variable ${key}. ` +
        `Add it to your .env file (see .env.example) and restart the dev server with "npx expo start --clear".`,
    );
  }

  return value.trim();
};

/**
 * Resolved configuration. Object is frozen so no module can mutate the
 * connection settings at runtime.
 */
export const env: Readonly<Env> = Object.freeze({
  supabaseUrl: requireEnv('EXPO_PUBLIC_SUPABASE_URL', SUPABASE_URL),
  supabasePublishableKey: requireEnv(
    'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    SUPABASE_PUBLISHABLE_KEY,
  ),
});