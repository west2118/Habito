import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { Radii } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type BackButtonProps = {
  onPress?: () => void;
  /** Where to go when there is no history to pop. Defaults to the app root. */
  fallbackHref?: Href;
  style?: StyleProp<ViewStyle>;
};

/** Circular back button used on pushed screens (e.g. New habit). */
export function BackButton({ onPress, fallbackHref = '/', style }: BackButtonProps) {
  const router = useRouter();
  const theme = useTheme();

  // `router.back()` logs a "GO_BACK was not handled by any navigator" warning
  // when the stack is empty (a deep link, or a web cold load straight onto this
  // screen). Fall back to a known route instead of doing nothing.
  const handlePress =
    onPress ??
    (() => {
      if (router.canGoBack()) {
        router.back();
        return;
      }

      router.replace(fallbackHref);
    });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Go back"
      onPress={handlePress}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: theme.backgroundElevated, opacity: pressed ? 0.7 : 1 },
        style,
      ]}>
      <Ionicons name="chevron-back" size={20} color={theme.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: 40,
    height: 40,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
