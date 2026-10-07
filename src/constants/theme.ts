/**
 * Habito design tokens.
 *
 * The Habito visual design is dark-only, so both color schemes share the same
 * palette for now. When a light theme is designed, add it to `Colors.light`
 * without touching component code — every component reads colors through
 * `useTheme()`.
 *
 * There are many other ways to style your app. For example,
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

const habitoColors = {
  text: Palette.white,
  textSecondary: Palette.gray[300],
  textMuted: Palette.gray[400],
  background: Palette.black,
  backgroundElement: Palette.gray[900],
  backgroundElevated: Palette.gray[800],
  backgroundSelected: Palette.gray[700],
  border: Palette.gray[700],
  primary: Palette.red[500],
  primaryBright: Palette.red[400],
  primaryDark: Palette.red[700],
  primarySoft: Palette.red.soft,
  onPrimary: Palette.white,
  tabBarInactive: Palette.gray[400],
} as const;

export const Colors = {
  light: habitoColors,
  dark: habitoColors,
} as const;

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
