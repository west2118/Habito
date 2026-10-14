/**
 * The preference is the whole feature: it chooses the palette on every screen
 * and has to survive a restart. These tests pin the resolution
 * (preference → scheme), the storage round trip, and what happens to
 * untrusted or unreadable stored values.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import {
  DEFAULT_SCHEME,
  THEME_STORAGE_KEY,
  ThemePreferenceProvider,
  useThemePreference,
  type ThemeContextValue,
} from '@/contexts/theme';

// AsyncStorage is the official Jest mock via `jest.config.js`, so this import
// is storage in memory — no stubbing needed per suite.

// The provider maps the device setting through this hook, so the tests drive it
// directly — that is the only way to make the "system" branch deterministic.
// The name must start with `mock` for Jest's hoisted factory to reach it.
let mockSystemScheme: 'light' | 'dark' = 'dark';

jest.mock('@/hooks/use-color-scheme', () => ({
  useColorScheme: () => mockSystemScheme,
}));

/** Latest context value, so tests can call the setter the UI would call. */
let context: ThemeContextValue;

function ThemeProbe() {
  context = useThemePreference();

  return <Text>{context.scheme}</Text>;
}

const renderProvider = async () => {
  let tree!: ReactTestRenderer;

  await act(async () => {
    tree = create(
      <ThemePreferenceProvider>
        <ThemeProbe />
      </ThemePreferenceProvider>,
    );
  });

  return tree;
};

/** Reads the scheme the way a screen would end up rendering it. */
const renderedScheme = (tree: ReactTestRenderer) => tree.root.findByType(Text).props.children;

describe('theme preference', () => {
  beforeEach(async () => {
    mockSystemScheme = 'dark';
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  it('starts on the app default when nothing has been saved', async () => {
    const tree = await renderProvider();

    expect(renderedScheme(tree)).toBe(DEFAULT_SCHEME);
    expect(context.preference).toBe(DEFAULT_SCHEME);
  });

  it('restores a saved preference instead of the default', async () => {
    await AsyncStorage.setItem(THEME_STORAGE_KEY, 'light');

    const tree = await renderProvider();

    expect(renderedScheme(tree)).toBe('light');
    expect(context.preference).toBe('light');
  });

  it('falls back to the default when the stored value is not a preference', async () => {
    await AsyncStorage.setItem(THEME_STORAGE_KEY, 'chartreuse');

    const tree = await renderProvider();

    expect(renderedScheme(tree)).toBe(DEFAULT_SCHEME);
  });

  it('applies and persists a new choice', async () => {
    const tree = await renderProvider();

    await act(async () => {
      context.setPreference('light');
    });

    expect(renderedScheme(tree)).toBe('light');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(THEME_STORAGE_KEY, 'light');
  });

  it('follows the device setting while the preference is "system"', async () => {
    await AsyncStorage.setItem(THEME_STORAGE_KEY, 'system');

    mockSystemScheme = 'light';
    const lightTree = await renderProvider();

    expect(renderedScheme(lightTree)).toBe('light');

    mockSystemScheme = 'dark';
    const darkTree = await renderProvider();

    expect(renderedScheme(darkTree)).toBe('dark');
  });

  it('ignores an unreadable store rather than rendering nothing', async () => {
    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('storage unavailable'));

    const tree = await renderProvider();

    expect(renderedScheme(tree)).toBe(DEFAULT_SCHEME);
  });
});
