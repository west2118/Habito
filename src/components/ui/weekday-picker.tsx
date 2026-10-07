import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Mon-first letters shown above the day circles, matching the reference design. */
export const WEEKDAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

export type WeekdayPickerProps = {
  /** Selected day indexes, 0 = Monday … 6 = Sunday. */
  value?: number[];
  onChange?: (value: number[]) => void;
  labels?: readonly string[];
  size?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Row of seven day-of-week circles used by the habit Schedule section.
 * Selecting a day toggles it.
 */
export function WeekdayPicker({
  value = [],
  onChange,
  labels = WEEKDAY_LETTERS,
  size = 44,
  style,
}: WeekdayPickerProps) {
  const theme = useTheme();

  const toggle = (index: number) => {
    if (!onChange) return;
    onChange(value.includes(index) ? value.filter((day) => day !== index) : [...value, index].sort((a, b) => a - b));
  };

  return (
    <View style={[styles.row, style]}>
      {labels.map((label, index) => {
        const isSelected = value.includes(index);
        return (
          <Pressable
            key={`${label}-${index}`}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={`Day ${index + 1}`}
            onPress={() => toggle(index)}
            style={({ pressed }) => [
              styles.day,
              {
                width: size,
                height: size,
                borderRadius: Radii.pill,
                backgroundColor: isSelected ? theme.primary : theme.backgroundElevated,
                opacity: pressed ? 0.8 : 1,
              },
            ]}>
            <Text
              style={[
                styles.letter,
                { color: isSelected ? theme.onPrimary : theme.textSecondary },
              ]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  day: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: {
    fontSize: 14,
    fontWeight: '700',
  },
});
