/**
 * Theme context: the user's light/dark/system preference for the whole app.
 *
 * The preference is the *choice* ("system" included); the scheme is what that
 * resolves to right now. Screens only ever read the resolved scheme (through
 * `useTheme`), so nothing downstream has to know the device setting exists.
 *
 * It lives on the device rather than the account: the choice is a property of
 * how this phone should look, and storing it locally means it applies
 * instantly on cold start with no round trip and no backend change.
 *
 * The provider renders nothing until the stored value has been read, which
 * holds the splash screen for the duration of one storage read and avoids a
 * frame of the wrong palette on launch.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import type { ColorScheme } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

/** What the settings UI offers. `system` follows the device setting. */
export type ThemePreference = ColorScheme | 'system';

/** The palette every install starts on — the app's original look. */
export const DEFAULT_SCHEME: ColorScheme = 'dark';

export const DEFAULT_THEME_PREFERENCE: ThemePreference = DEFAULT_SCHEME;

/** Per-device storage key for the choice. */
export const THEME_STORAGE_KEY = 'habito.theme-preference';

const THEME_PREFERENCES: readonly ThemePreference[] = ['light', 'dark', 'system'];

/** Narrows a value read back from storage, which is untrusted input. */
export const isThemePreference = (value: unknown): value is ThemePreference =>
  typeof value === 'string' && (THEME_PREFERENCES as readonly string[]).includes(value);

export type ThemeContextValue = {
  /** What the user chose; may be `system`. */
  preference: ThemePreference;
  /** What that choice resolves to right now. */
  scheme: ColorScheme;
  setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Resolves the device setting.
 *
 * React Native reports `null` before the platform has answered, and any value
 * it does not recognise is treated the same way: fall back to the app's own
 * default rather than inventing a light appearance the user never asked for.
 */
const toScheme = (scheme: string | null | undefined): ColorScheme =>
  scheme === 'light' ? 'light' : DEFAULT_SCHEME;

/**
 * Reads the active palette name.
 *
 * Deliberately tolerant: a component rendered outside the provider (a unit
 * test, a preview) gets the app's default instead of throwing, because the
 * theme is presentation — unlike the session, nothing depends on it existing.
 */
export function useThemeScheme(): ColorScheme {
  return use(ThemeContext)?.scheme ?? DEFAULT_SCHEME;
}

/**
 * Reads and changes the preference.
 *
 * Deliberately strict, the opposite of `useThemeScheme`: its only callers are
 * settings controls, which always sit inside the provider, and swallowing a
 * change there would look exactly like a broken switch.
 */
export function useThemePreference(): ThemeContextValue {
  const value = use(ThemeContext);

  if (value === null) {
    throw new Error('useThemePreference must be used inside <ThemePreferenceProvider>.');
  }

  return value;
}

export function ThemePreferenceProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>(DEFAULT_THEME_PREFERENCE);
  const [isRestored, setIsRestored] = useState(false);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);

        if (active && isThemePreference(stored)) {
          setPreferenceState(stored);
        }
      } catch {
        // Unreadable storage simply means the default stands.
      }

      if (active) {
        setIsRestored(true);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);

    // Fire-and-forget: the UI has already switched, and a failed write only
    // costs the choice on the next cold start.
    void AsyncStorage.setItem(THEME_STORAGE_KEY, next).catch(() => {});
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      preference,
      scheme: preference === 'system' ? toScheme(systemScheme) : preference,
      setPreference,
    }),
    [preference, setPreference, systemScheme],
  );

  if (!isRestored) {
    return null;
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
