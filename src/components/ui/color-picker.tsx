import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { PickerModal } from '@/components/ui/picker-modal';
import { ThemedText } from '@/components/themed-text';
import { demoHabitColors } from '@/constants/demo-data';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ColorPickerProps = {
  /** Current accent as a hex string stored on the habit row. */
  value: string;
  onChange: (color: string) => void;
};

/**
 * Compact accent-colour chooser for the New/Edit habit form.
 *
 * Kept separate from {@link IconPicker} on purpose: icon and colour are
 * independent choices, so each gets its own row and its own sheet rather than
 * one crowded combined grid.
 */
export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const theme = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  const currentLabel =
    demoHabitColors.find((option) => option.value.toLowerCase() === value.toLowerCase())?.label ??
    'Custom';

  const close = useCallback(() => setIsOpen(false), []);

  const select = useCallback(
    (color: string) => {
      onChange(color);
      close();
    },
    [close, onChange],
  );

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Choose colour. Current colour: ${currentLabel}`}
        onPress={() => setIsOpen(true)}
        style={({ pressed }) => [
          styles.field,
          { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.85 : 1 },
        ]}>
        <View style={[styles.preview, { backgroundColor: value }]} />
        <View style={styles.fieldText}>
          <ThemedText type="smallBold">Colour</ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            {currentLabel}
          </ThemedText>
        </View>
        <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
      </Pressable>

      <PickerModal
        visible={isOpen}
        title="Choose a colour"
        subtitle="The accent used for this habit's icon."
        onClose={close}>
        <View style={styles.grid}>
          {demoHabitColors.map(({ value: hex, label }) => {
            const isSelected = hex.toLowerCase() === value.toLowerCase();

            return (
              <Pressable
                key={hex}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={label}
                onPress={() => select(hex)}
                style={({ pressed }) => [
                  styles.option,
                  {
                    backgroundColor: theme.backgroundElevated,
                    borderColor: isSelected ? theme.primary : 'transparent',
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}>
                {/* `hex` is a plain string, not a Reanimated shared value — but
                    reading `<object>.value` inside an inline style trips
                    Reanimated's dev-time heuristic, which then warns that a
                    shared value is being read with `.value`. Destructuring the
                    hex into its own name keeps the style free of that shape. */}
                <View style={[styles.swatch, { backgroundColor: hex }]}>
                  {isSelected && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                </View>
                <ThemedText type="small">{label}</ThemedText>
              </Pressable>
            );
          })}
        </View>
      </PickerModal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 4,
    borderRadius: Radii.lg,
  },
  preview: {
    width: 40,
    height: 40,
    borderRadius: Radii.pill,
  },
  fieldText: {
    flex: 1,
    gap: 1,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  option: {
    flexBasis: '48%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 2,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    borderRadius: Radii.md,
    borderWidth: 1,
  },
  swatch: {
    width: 24,
    height: 24,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
