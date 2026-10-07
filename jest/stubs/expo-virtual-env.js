/**
 * Node-environment stand-in for `expo/virtual/env`.
 *
 * `babel-preset-expo` rewrites `process.env.EXPO_PUBLIC_FOO` into an import of
 * `expo/virtual/env` outside production, and the real module is untranspiled
 * ESM (`export const env = process.env`). Jest's CommonJS transform cannot load
 * it directly, so this mirrors its one documented behaviour: expose the live
 * `process.env`.
 *
 * Loading `.env` is `jest/setup-integration.js`'s job — this just reads it.
 */

exports.env = process.env;