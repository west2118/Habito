import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'text';
export type ButtonSize = 'lg' | 'md' | 'sm';

export type ButtonProps = {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Optional leading icon element, e.g. `<Ionicons name="camera" ... />`. */
  icon?: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  /** Stretch to the available width. Defaults to true. */
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const SIZES: Record<ButtonSize, { height: number; paddingHorizontal: number; radius: number; fontSize: number }> = {
  lg: { height: 54, paddingHorizontal: Spacing.four, radius: Radii.lg, fontSize: 16 },
  md: { height: 48, paddingHorizontal: Spacing.three, radius: Radii.md, fontSize: 15 },
  sm: { height: 36, paddingHorizontal: Spacing.two + 6, radius: Radii.md, fontSize: 13 },
};

/**
 * The app's single pressable button. Variants cover every button in the
 * design: filled red (primary), outlined (outline), dark surface (ghost) and
 * colored text-only (text, e.g. "Delete").
 */
export function Button({
  label,
  variant = 'primary',
  size = 'md',
  icon,
  onPress,
  disabled = false,
  fullWidth = true,
  style,
  testID,
}: ButtonProps) {
  const theme = useTheme();
  const metrics = SIZES[size];

  const backgroundColor =
    variant === 'primary'
      ? theme.primary
      : variant === 'ghost'
        ? theme.backgroundElevated
        : 'transparent';

  const textColor =
    variant === 'primary' ? theme.onPrimary : variant === 'text' ? theme.primary : theme.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        {
          height: metrics.height,
          paddingHorizontal: metrics.paddingHorizontal,
          borderRadius: metrics.radius,
          backgroundColor,
          borderWidth: variant === 'outline' ? 1 : 0,
          borderColor: theme.border,
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
        },
        fullWidth && styles.fullWidth,
        style,
      ]}>
      {icon}
      <Text
        style={[
          styles.label,
          { fontSize: metrics.fontSize, color: textColor },
          size === 'lg' && styles.labelLarge,
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  label: {
    fontWeight: '600',
  },
  labelLarge: {
    fontWeight: '700',
  },
});
