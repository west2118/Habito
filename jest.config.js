/**
 * Jest configuration.
 *
 * Two projects, because this repo tests two genuinely different things:
 *
 * 1. `integration` — plain Node, real HTTP against the live Supabase project.
 *    Runs in the `node` test environment rather than `jest-expo` on purpose:
 *    the Expo preset installs the "winter" runtime, which swaps the global
 *    `fetch` for a native-backed implementation that cannot function outside a
 *    real device runtime, and every request then fails on a cross-realm
 *    `instanceof` check with a bare "fetch failed". The handful of React Native
 *    modules the app imports are mapped to small stubs instead.
 *
 * 2. `expo` — the `jest-expo` preset, for component and hook tests that need
 *    React Native itself. Empty for now; it is here so UI tests have a home
 *    without reconfiguring Jest later.
 *
 * Both projects share `jest/setup-env.js` so `.env` is loaded the same way.
 */

/** @type {import('jest').Config} */
module.exports = {
  projects: [
    {
      displayName: 'integration',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/__tests__/**/*.test.ts'],
      setupFiles: ['<rootDir>/jest/setup-integration.js'],
      // 60s: each assertion can be a real round trip to Supabase, and a cold
      // TLS handshake plus a sign-up can exceed the 5s default comfortably.
      testTimeout: 60_000,
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^react-native$': '<rootDir>/jest/stubs/react-native.js',
        '^expo-linking$': '<rootDir>/jest/stubs/expo-linking.js',
        '^expo-secure-store$': '<rootDir>/jest/stubs/secure-store.js',
        // Node already ships a WHATWG-compliant URL implementation, so the
        // React Native polyfill is unnecessary here — and it is untranspiled ESM
        // that the Node project would otherwise have to compile.
        '^react-native-url-polyfill(/.*)?$': '<rootDir>/jest/stubs/empty.js',
        // Untranspiled ESM in node_modules; the stub keeps it CommonJS.
        '^expo/virtual/env$': '<rootDir>/jest/stubs/expo-virtual-env.js',
        '^@react-native-async-storage/async-storage$':
          '@react-native-async-storage/async-storage/jest/async-storage-mock',
      },
      transform: {
        '^.+\\.[jt]sx?$': ['babel-jest', { presets: ['babel-preset-expo'] }],
      },
      // Everything in node_modules is published CJS or pre-compiled; only our own
      // sources need transforming.
      transformIgnorePatterns: ['/node_modules/(?!react-native-url-polyfill/)'],
    },
    {
      displayName: 'expo',
      preset: 'jest-expo',
      testMatch: ['<rootDir>/__tests__/**/*.test.tsx'],
      setupFiles: ['<rootDir>/jest/setup-env.js'],
    },
  ],
};