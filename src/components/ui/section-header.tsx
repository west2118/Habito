import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { Radii, Spacing } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

export type SectionHeaderProps = {
  title: string;
  /** Right-aligned element, e.g. "proofs logged" or "This week". */
  trailing?: ReactNode;
  /** Red count badge shown next to the title (e.g. habits due today). */
  badge?: number | string;
  style?: StyleProp<ViewStyle>;
};

/** Title row used above content blocks ("Today's Habits", "Recent Activity", ...). */
export function SectionHeader({ title, trailing, badge, style }: SectionHeaderProps) {
  const theme = useTheme();

  return (
    <View style={[styles.row, style]}>
      <View style={styles.titleGroup}>
        <ThemedText type="section">{title}</ThemedText>
        {badge !== undefined && (
          <View style={[styles.badge, { backgroundColor: theme.primary }]}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        )}
      </View>
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: Radii.pill,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  } satisfies TextStyle,
});
