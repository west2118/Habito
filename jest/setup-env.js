/**
 * Jest `setupFiles` entry: makes `.env` visible to the modules under test.
 *
 * Why this is needed: outside production, `babel-preset-expo` rewrites
 * `process.env.EXPO_PUBLIC_FOO` into an import of `expo/virtual/env`, whose
 * entire contents are `export const env = process.env`. So the value is read
 * from `process.env` at *runtime*, not baked in at transform time.
 *
 * `expo start` loads `.env` for us; Jest does not. Without this file
 * `src/lib/env.ts` would throw "Missing environment variable".
 *
 * `.env` is loaded first, then `.env.local` with `override: true` so a local
 * file can shadow the committed defaults, matching Expo's own precedence.
 */

const { config } = require('dotenv');

// `quiet` suppresses dotenv v18's startup banner, which otherwise prints a
// stack-trace-looking block for every line it injects and buries real failures.
config({ path: '.env', quiet: true });
config({ path: '.env.local', override: true, quiet: true });

const REQUIRED_KEYS = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY'];
const missing = REQUIRED_KEYS.filter((key) => !process.env[key]);

if (missing.length > 0) {
  throw new Error(
    `[Habito] Integration tests need ${missing.join(' and ')} in .env. ` +
      'Copy .env.example to .env and fill in the values from the Supabase dashboard.',
  );
}