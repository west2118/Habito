import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { IconOption } from '@/components/ui/icon-option';
import { PickerModal } from '@/components/ui/picker-modal';
import { ThemedText } from '@/components/themed-text';
import { demoHabitIcons, type IoniconName } from '@/constants/demo-data';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type IconPickerProps = {
  /** Current Ionicons name; unknown values fall back to `flag`. */
  value: string;
  /** Accent the preview tile uses, so the icon shows in its habit colour. */
  color: string;
  onChange: (icon: string) => void;
};

/**
 * Compact icon chooser for the New/Edit habit form.
 *
 * Renders a single summary row instead of the full grid of tiles, which kept
 * the form crowded. Tapping the row opens the icon list in a bottom sheet.
 *
 * The preview is painted with the habit's accent colour so the icon and colour
 * choices read as one result.
 */
export function IconPicker({ value, color, onChange }: IconPickerProps) {
  const theme = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  const iconName = (value || 'flag') as IoniconName;
  const currentLabel =
    demoHabitIcons.find((option) => option.icon === value)?.label ?? 'Custom';

  const close = useCallback(() => setIsOpen(false), []);

  const select = useCallback(
    (icon: string) => {
      onChange(icon);
      close();
    },
    [close, onChange],
  );

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Choose icon. Current icon: ${currentLabel}`}
        onPress={() => setIsOpen(true)}
        style={({ pressed }) => [
          styles.field,
          { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.85 : 1 },
        ]}>
        <View style={styles.preview}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: color, opacity: 0.18 }]} />
          <Ionicons name={iconName} size={18} color={color} />
        </View>
        <View style={styles.fieldText}>
          <ThemedText type="smallBold">Icon</ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            {currentLabel}
          </ThemedText>
        </View>
        <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
      </Pressable>

      <PickerModal
        visible={isOpen}
        title="Choose an icon"
        subtitle="Tap an icon to use it for this habit."
        onClose={close}>
        <View style={styles.grid}>
          {demoHabitIcons.map((option) => (
            <IconOption
              key={option.icon}
              icon={option.icon}
              label={option.label}
              selected={option.icon === value}
              onPress={() => select(option.icon)}
              style={styles.gridItem}
            />
          ))}
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
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fieldText: {
    flex: 1,
    gap: 1,
  },
  // Two columns so the icon labels stay readable inside the sheet.
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  gridItem: {
    flexBasis: '48%',
    flexGrow: 1,
  },
});
