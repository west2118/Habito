/**
 * The single Supabase client used by the whole app.
 *
 * Authentication is the only piece wired up here; habits, logs, albums and
 * storage uploads get their own modules that import this client.
 *
 * Security notes:
 * - The client is created with the *publishable* key only. It carries no
 *   privileges beyond anonymous access, so the Postgres RLS policies are what
 *   actually protect user data. Never swap in the `service_role` key.
 * - Sessions are persisted in the OS keychain via `expo-secure-store`, not
 *   AsyncStorage, so a token cannot be read out of a plain-text store on a
 *   compromised device.
 * - The client is created lazily and memoised. `createClient` registers an
 *   `onAuthStateChange` listener and starts token-refresh timers, so creating
 *   more than one instance (or creating one per render) leaks listeners.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createClient,
  isAuthError,
  type Session,
  type SupabaseClient,
  type SupportedStorage,
} from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import 'react-native-url-polyfill/auto';

import { env } from '@/lib/env';

/**
 * iOS keychain entries larger than roughly 2 KB are rejected on some releases,
 * and a Supabase session (JWT + refresh token + user metadata) routinely
 * exceeds that. `expo-secure-store` does not enforce the limit, so we would
 * silently fail on device. This adapter splits oversized values across numbered
 * entries and stitches them back together on read.
 */
const MAX_VALUE_LENGTH = 2048;

const KEYCHAIN_OPTIONS = {
  // Readable after the first unlock following a reboot (background refresh must
  // still work) without migrating the token to other devices via a backup.
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
} as const;

const chunkKey = (key: string, index: number): string => `${key}.${index}`;

const splitIntoChunks = (value: string): string[] => {
  const chunks: string[] = [];

  for (let index = 0; index < value.length; index += MAX_VALUE_LENGTH) {
    chunks.push(value.slice(index, index + MAX_VALUE_LENGTH));
  }

  return chunks;
};

/** Keychain-backed session storage, with transparent chunking. */
const createSecureStoreStorage = (): SupportedStorage => ({
  getItem: async (key) => {
    const whole = await SecureStore.getItemAsync(key, KEYCHAIN_OPTIONS);

    if (whole !== null) {
      return whole;
    }

    const parts: string[] = [];

    // Chunks are contiguous from index 0, so the first gap marks the end.
    for (let index = 0; ; index += 1) {
      const part = await SecureStore.getItemAsync(chunkKey(key, index), KEYCHAIN_OPTIONS);

      if (part === null) {
        break;
      }

      parts.push(part);
    }

    return parts.length > 0 ? parts.join('') : null;
  },

  setItem: async (key, value) => {
    // Clear any previous representation first, otherwise shrinking a value
    // would leave orphaned chunks that get re-appended on the next read.
    await SecureStore.deleteItemAsync(key, KEYCHAIN_OPTIONS);

    for (let index = 0; ; index += 1) {
      const stale = await SecureStore.getItemAsync(chunkKey(key, index), KEYCHAIN_OPTIONS);

      if (stale === null) {
        break;
      }

      await SecureStore.deleteItemAsync(chunkKey(key, index), KEYCHAIN_OPTIONS);
    }

    if (value.length <= MAX_VALUE_LENGTH) {
      await SecureStore.setItemAsync(key, value, KEYCHAIN_OPTIONS);
      return;
    }

    await Promise.all(
      splitIntoChunks(value).map((chunk, index) =>
        SecureStore.setItemAsync(chunkKey(key, index), chunk, KEYCHAIN_OPTIONS),
      ),
    );
  },

  removeItem: async (key) => {
    await SecureStore.deleteItemAsync(key, KEYCHAIN_OPTIONS);

    for (let index = 0; ; index += 1) {
      const existing = await SecureStore.getItemAsync(chunkKey(key, index), KEYCHAIN_OPTIONS);

      if (existing === null) {
        break;
      }

      await SecureStore.deleteItemAsync(chunkKey(key, index), KEYCHAIN_OPTIONS);
    }
  },
});

/**
 * Web has no keychain. `SecureStore` reports itself unavailable there, so we
 * fall back to AsyncStorage (backed by localStorage) — acceptable because the
 * browser already keeps the session in httpOnly cookies when cookies are
 * enabled, and it keeps the same adapter shape across platforms.
 */
const createWebStorage = (): SupportedStorage => ({
  getItem: async (key) => AsyncStorage.getItem(key),
  setItem: async (key, value) => {
    await AsyncStorage.setItem(key, value);
  },
  removeItem: async (key) => {
    await AsyncStorage.removeItem(key);
  },
});

/**
 * `expo-secure-store` is a native module, so it cannot be touched at import
 * time on web. Guard with `Platform.OS` and let `isAvailableAsync` cover the
 * remaining cases (e.g. a device with the keychain locked or unavailable).
 */
const resolveStorage = async (): Promise<SupportedStorage> => {
  if (Platform.OS !== 'web' && (await SecureStore.isAvailableAsync())) {
    return createSecureStoreStorage();
  }

  return createWebStorage();
};

let clientPromise: Promise<SupabaseClient> | null = null;

const createSupabaseClient = async (): Promise<SupabaseClient> => {
  const storage = await resolveStorage();

  return createClient(env.supabaseUrl, env.supabasePublishableKey, {
    auth: {
      storage,
      persistSession: true,
      autoRefreshToken: true,
      // React Native has no browser URL bar to parse a hash fragment out of.
      // Deep-link/PKCE redirects are handled explicitly when OAuth is added.
      detectSessionInUrl: false,
    },
  });
};

/**
 * Returns the shared Supabase client, creating it on first use.
 *
 * The returned promise is memoised, so concurrent callers (for example several
 * components mounting at once on first render) share a single client instead of
 * racing to construct one each.
 */
export const getSupabase = (): Promise<SupabaseClient> => {
  if (clientPromise === null) {
    clientPromise = createSupabaseClient().catch((error: unknown) => {
      // Do not cache a failed initialisation; a later attempt should be able to
      // retry (e.g. once the keychain becomes available).
      clientPromise = null;
      throw error;
    });
  }

  return clientPromise;
};

/** Typed convenience accessor for the current session. */
export const getSession = async (): Promise<Session | null> => {
  const client = await getSupabase();
  const { data, error } = await client.auth.getSession();

  if (error) {
    throw isAuthError(error) ? error : new Error('Could not read the current session.');
  }

  return data.session;
};