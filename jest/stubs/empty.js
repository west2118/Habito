/**
 * Empty module, used as a `moduleNameMapper` target for side-effect-only
 * imports that should be no-ops in the Node integration environment.
 *
 * Currently mapped to `react-native-url-polyfill`, which exists purely to give
 * React Native a WHATWG `URL`/`URLSearchParams`. Node has had both built in
 * since v10, and its polyfill ships as untranspiled ESM.
 */

module.exports = {};