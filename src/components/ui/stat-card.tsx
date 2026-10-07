import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Spacing } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import type { IoniconName } from '@/constants/demo-data';

import { Ionicons } from '@expo/vector-icons';

export type StatCardProps = {
  icon: IoniconName;
  /** Tiny top-right tag: "now", "PR", "tracked"... */
  tag?: string;
  value: string;
  /** Small unit next to the value: "days", "%", "photos"... */
  unit?: string;
  label: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Metric tile. Used both for the three compact "Today" tiles (no tag/unit)
 * and the six Analytics tiles.
 */
export function StatCard({ icon, tag, value, unit, label, style }: StatCardProps) {
  const theme = useTheme();

  return (
    <Card style={[styles.card, style]}>
      <View style={styles.topRow}>
        <Ionicons name={icon} size={18} color={theme.primary} />
        {tag && <Chip label={tag} tone="muted" size="xs" />}
      </View>
      <View style={styles.valueRow}>
        <ThemedText type="stat">{value}</ThemedText>
        {unit && (
          <ThemedText type="caption" themeColor="textSecondary" style={styles.unit}>
            {unit}
          </ThemedText>
        )}
      </View>
      <ThemedText type="caption" themeColor="textSecondary">
        {label}
      </ThemedText>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.two,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.half + 2,
    marginTop: Spacing.one,
  },
  unit: {
    fontWeight: '600',
  },
});
