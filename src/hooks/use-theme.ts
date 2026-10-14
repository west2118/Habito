/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 *
 * The scheme comes from the user's preference (Profile → Appearance) rather
 * than straight from the device, so "system" is the only preference that
 * follows the device at all. Every component reads colors through this hook,
 * which is what keeps them theme-agnostic.
 */

import { Colors } from '@/constants/theme';
import { useThemeScheme } from '@/contexts/theme';

export function useTheme() {
  return Colors[useThemeScheme()];
}
