import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Card } from '@/components/ui/card';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { IoniconName } from '@/constants/demo-data';

export type EmptyStateProps = {
  icon?: IoniconName;
  message: string;
  style?: StyleProp<ViewStyle>;
};

/** Centered empty state inside a card (e.g. "No activity yet..."). */
export function EmptyState({ icon = 'time', message, style }: EmptyStateProps) {
  const theme = useTheme();

  return (
    <Card style={[styles.card, style]}>
      <View style={[styles.iconCircle, { backgroundColor: theme.primarySoft }]}>
        <Ionicons name={icon} size={26} color={theme.primary} />
      </View>
      <Text style={[styles.message, { color: theme.textSecondary }]}>{message}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.four,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    textAlign: 'center',
  },
});
