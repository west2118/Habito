/**
 * Habito design tokens.
 *
 * Two palettes, one set of role names: components never branch on the theme,
 * they read colors through `useTheme()` and get whichever palette is active.
 * That is why `light` and `dark` must keep exactly the same keys — `ThemeColor`
 * is their intersection.
 *
 * The elevation roles keep their *relationship* rather than their literal
 * values: `backgroundElement` is the resting card surface and
 * `backgroundElevated` the more raised one, which means darker than the card in
 * light mode and lighter in dark mode.
 *
 * There are many other ways to style your app. For example:
 * [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/),
 * [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

/** Raw brand palette. Prefer theme colors (`useTheme()`) over raw palette values in components. */
export const Palette = {
  black: '#000000',
  white: '#FFFFFF',
  red: {
    400: '#FF2A38',
    500: '#E1121F',
    700: '#A00C16',
    soft: 'rgba(225, 18, 31, 0.16)',
  },
  gray: {
    900: '#121214',
    850: '#17171A',
    800: '#1C1C20',
    700: '#242429',
    600: '#2E2E34',
    400: '#7C7C83',
    300: '#9A9AA0',
  },
} as const;


const darkColors = {
  text: Palette.white,
  textSecondary: Palette.gray[300],
  textMuted: Palette.gray[400],
  background: Palette.black,
  backgroundElement: Palette.gray[900],
  backgroundElevated: Palette.gray[800],
  backgroundSelected: Palette.gray[700],
  border: Palette.gray[700],
  cardBorder: 'transparent',
  tabBarBackground: Palette.black,
  primary: Palette.red[500],
  primaryBright: Palette.red[400],
  primaryDark: Palette.red[700],
  primarySoft: Palette.red.soft,
  onPrimary: Palette.white,
  tabBarInactive: Palette.gray[400],
} as const;

/**
 * Shape every color scheme must satisfy. Values stay free-form strings so a
 * scheme can use its own ramp (a `typeof darkColors` annotation would pin each
 * key to the dark literal and make a real light theme unrepresentable).
 */
type ThemeColors = Record<keyof typeof darkColors, string>;

/**
 * Light theme.
 *
 * Pure white canvas (#FFFFFF) with clean, light-white card surfaces (#FAFAFC),
 * delicate hairline borders (#ECEEF2), and soft near-white elevated controls (#F1F3F6).
 */
const lightColors: ThemeColors = {
  text: '#111827',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  background: '#FFFFFF',
  backgroundElement: '#FAFAFC',
  backgroundElevated: '#F1F3F6',
  backgroundSelected: '#E2E5EA',
  border: '#ECEEF2',
  cardBorder: '#ECEEF2',
  tabBarBackground: '#FFFFFF',
  primary: Palette.red[500],
  primaryBright: Palette.red[400],
  primaryDark: Palette.red[700],
  primarySoft: 'rgba(225, 18, 31, 0.10)',
  onPrimary: Palette.white,
  tabBarInactive: '#9CA3AF',
};

export const Colors = {
  light: lightColors,
  dark: darkColors,
} as const;

export type ColorScheme = keyof typeof Colors;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

/** Content height of the custom bottom tab bar (excludes the safe-area inset). */
export const BottomTabInset = 56;

export const MaxContentWidth = 480;
