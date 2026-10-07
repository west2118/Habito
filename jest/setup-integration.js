/**
 * Setup for the Node-based integration test project.
 *
 * Loads `.env` into `process.env` so `src/lib/env.ts` can resolve its settings,
 * and asserts that a working `fetch` exists before any test runs.
 *
 * Why the environment matters here: outside production, `babel-preset-expo`
 * rewrites `process.env.EXPO_PUBLIC_FOO` into an import of `expo/virtual/env`,
 * whose contents are simply `export const env = process.env`. So the values are
 * read from `process.env` at runtime. `expo start` populates that; Jest does not.
 */

const { config } = require('dotenv');

// `quiet` suppresses dotenv's v18 startup banner, which otherwise prints a
// stack-trace-looking block per injected line and buries real failures.
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

/**
 * Fail loudly and early if `fetch` is missing or stubbed.
 *
 * A silently non-functional `fetch` is the single most misleading failure mode
 * here: every test would report a generic "fetch failed", or worse, appear to
 * pass while never reaching the network at all.
 */
if (typeof globalThis.fetch !== 'function') {
  throw new Error(
    '[Habito] No global fetch available. The integration tests require Node 18+ ' +
      'running under the node test environment (not the React Native one).',
  );
}