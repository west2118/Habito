import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { IoniconName } from '@/constants/demo-data';

export type IconOptionProps = {
  icon: IoniconName;
  label: string;
  selected?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

/** Selectable icon tile shown in the icon picker's bottom sheet. */
export function IconOption({ icon, label, selected = false, onPress, style }: IconOptionProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        {
          backgroundColor: selected ? theme.primary : theme.backgroundElevated,
          opacity: pressed ? 0.8 : 1,
        },
        style,
      ]}>
      <Ionicons name={icon} size={15} color={selected ? theme.onPrimary : theme.textSecondary} />
      <Text
        numberOfLines={1}
        style={[styles.label, { color: selected ? theme.onPrimary : theme.text }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one + 2,
    height: 48,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.one,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
});
