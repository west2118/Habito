/**
 * Minimal `react-native` stub for the Node integration-test project.
 *
 * The integration suites exercise real HTTP against the live Supabase project,
 * so they must run in a plain Node environment rather than the React Native one
 * — `jest-expo` installs Expo's "winter" runtime, which replaces the global
 * `fetch` with a native-backed implementation that cannot work outside a real
 * runtime, and every request then fails with a realm/`instanceof` error.
 *
 * The app modules under test only need `Platform` from `react-native` (see
 * `src/lib/supabase.ts`, which branches on `Platform.OS` to choose between
 * SecureStore and AsyncStorage). Everything else is stubbed as inert so an
 * unexpected import surfaces loudly rather than silently returning undefined.
 */

const Platform = {
  OS: 'ios',
  select: (specifics) =>
    Object.prototype.hasOwnProperty.call(specifics, 'ios') ? specifics.ios : specifics.default,
};

module.exports = {
  Platform,
  // Present so `import ... from 'react-native'` of a component would fail with a
  // clear "not implemented" rather than an obscure undefined-value error.
  __stubbedForIntegrationTests: true,
};