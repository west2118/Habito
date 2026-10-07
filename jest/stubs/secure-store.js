/**
 * In-memory `expo-secure-store` double.
 *
 * `expo-secure-store` is a native module backed by the iOS keychain / Android
 * Keystore, neither of which exists in Node. A plain `Map` is deterministic and,
 * importantly, stores every key verbatim — including the `key.0`, `key.1`
 * chunk keys that `src/lib/supabase.ts` creates for values over 2 KB. That way
 * the chunking logic in the storage adapter is genuinely exercised by the auth
 * tests rather than silently bypassed by a smarter mock.
 */

const store = new Map();

const SecureStore = {
  __store: store,
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'afterFirstUnlockThisDeviceOnly',
  WHEN_UNLOCKED: 'whenUnlocked',
  isAvailableAsync: async () => true,
  getItemAsync: async (key) => (store.has(key) ? store.get(key) : null),
  setItemAsync: async (key, value) => {
    store.set(key, value);
  },
  deleteItemAsync: async (key) => {
    store.delete(key);
  },
};

module.exports = SecureStore;