/**
 * Minimal `expo-linking` stub.
 *
 * `src/lib/auth/auth.ts` builds the email-confirmation redirect URL with
 * `Linking.createURL`, which reads the scheme out of the Expo config. Outside a
 * running Expo app there is no config to read, and the real module throws.
 *
 * Returning a scheme-shaped URL keeps the code path under test identical to
 * production while remaining deterministic across platforms.
 */

const SCHEME = 'habittracker';

module.exports = {
  createURL: (path) => (path ? `${SCHEME}://${String(path).replace(/^\/+/, '')}` : `${SCHEME}://`),
  parse: (url) => ({ hostname: null, path: null, queryParams: null, scheme: SCHEME }),
  openURL: async () => true,
  canOpenURL: async () => true,
};