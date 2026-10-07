import type { ReactNode } from 'react';
import { StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { View } from 'react-native';

import { Radii } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ChipTone = 'neutral' | 'muted' | 'red' | 'outline';

export type ChipProps = {
  label: string;
  /** Optional leading element (icon or status dot). */
  icon?: ReactNode;
  tone?: ChipTone;
  /** `xs` is used for tiny analytics tags, `sm` for inline status chips. */
  size?: 'xs' | 'sm';
  style?: StyleProp<ViewStyle>;
};

/** Small pill used for statuses ("Synced"), streak badges ("6d") and tags ("now"). */
export function Chip({ label, icon, tone = 'neutral', size = 'sm', style }: ChipProps) {
  const theme = useTheme();

  const backgroundColor =
    tone === 'red'
      ? theme.primarySoft
      : tone === 'outline'
        ? 'transparent'
        : theme.backgroundElevated;

  const color = tone === 'red' ? theme.primary : tone === 'muted' ? theme.textSecondary : theme.text;

  return (
    <View
      style={[
        styles.base,
        size === 'xs' ? styles.xs : styles.sm,
        {
          backgroundColor,
          borderWidth: tone === 'outline' ? 1 : 0,
          borderColor: theme.border,
        },
        style,
      ]}>
      {icon}
      <Text style={[styles.label, { fontSize: size === 'xs' ? 10 : 11, color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: Radii.pill,
    alignSelf: 'flex-start',
  },
  sm: {
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  xs: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  label: {
    fontWeight: '600',
  },
});
