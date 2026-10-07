import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { BackButton } from '@/components/ui/back-button';
import { Spacing } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';

export type ScreenHeaderProps = {
  title: string;
  /** String subtitles render as secondary text; nodes allow richer content (e.g. date + status chip). */
  subtitle?: ReactNode;
  /** Small uppercase label above the title (e.g. "RECURRING"). */
  eyebrow?: string;
  /** Show the circular back button above the header. */
  showBack?: boolean;
  /** Right-aligned element on the title row (e.g. the notification bell). */
  trailing?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * The standard page header: optional back button, optional eyebrow label,
 * serif title and optional subtitle row.
 */
export function ScreenHeader({
  title,
  subtitle,
  eyebrow,
  showBack = false,
  trailing,
  style,
}: ScreenHeaderProps) {
  return (
    <View style={[styles.container, style]}>
      {showBack && <BackButton style={styles.back} />}
      {eyebrow && (
        <ThemedText type="eyebrow" themeColor="primary">
          {eyebrow}
        </ThemedText>
      )}
      <View style={styles.titleRow}>
        <ThemedText type="screenTitle">{title}</ThemedText>
        {trailing}
      </View>
      {typeof subtitle === 'string' ? (
        <ThemedText type="small" themeColor="textSecondary">
          {subtitle}
        </ThemedText>
      ) : (
        subtitle
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.one,
  },
  back: {
    marginBottom: Spacing.two,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
});
