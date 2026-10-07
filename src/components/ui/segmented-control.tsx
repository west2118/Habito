import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type SegmentedControlProps = {
  options: readonly string[];
  value: string;
  onChange?: (value: string) => void;
  style?: StyleProp<ViewStyle>;
};

/** Pill segmented control (Week / Month / Year on the Analytics screen). */
export function SegmentedControl({ options, value, onChange, style }: SegmentedControlProps) {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundElevated }, style]}>
      {options.map((option) => {
        const isSelected = option === value;
        return (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            onPress={() => onChange?.(option)}
            style={({ pressed }) => [
              styles.segment,
              isSelected && { backgroundColor: theme.primary },
              pressed && !isSelected && styles.pressed,
            ]}>
            <Text
              style={[
                styles.label,
                { color: isSelected ? theme.onPrimary : theme.textSecondary },
              ]}>
              {option}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: Spacing.half,
    borderRadius: Radii.pill,
    gap: Spacing.half,
  },
  segment: {
    flex: 1,
    height: 36,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
});
