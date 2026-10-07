import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { Radii } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type BackButtonProps = {
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

/** Circular back button used on pushed screens (e.g. New habit). */
export function BackButton({ onPress, style }: BackButtonProps) {
  const router = useRouter();
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Go back"
      onPress={onPress ?? (() => router.back())}
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
