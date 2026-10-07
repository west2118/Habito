import { StyleSheet, View, type ViewProps } from 'react-native';

import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type CardVariant = 'default' | 'elevated' | 'outline';

export type CardProps = ViewProps & {
  variant?: CardVariant;
  /** Card padding. Defaults to 16. Use 0 to manage padding via children. */
  padded?: boolean;
};

/** Surface container used across every screen (dark #121214 cards). */
export function Card({ variant = 'default', padded = true, style, ...rest }: CardProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.base,
        padded && styles.padded,
        variant === 'default' && { backgroundColor: theme.backgroundElement },
        variant === 'elevated' && { backgroundColor: theme.backgroundElevated },
        variant === 'outline' && {
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: theme.border,
        },
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radii.lg,
    overflow: 'hidden',
  },
  padded: {
    padding: Spacing.three,
  },
});
