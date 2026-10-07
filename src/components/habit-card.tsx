import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Button, Card, Chip } from '@/components/ui';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { IoniconName } from '@/constants/demo-data';

export type HabitSummary = {
  title: string;
  icon: IoniconName;
  streakDays: number;
};

export type HabitCardProps = {
  habit: HabitSummary;
  /** Omit during the design phase to render inert buttons. */
  onProof?: () => void;
  onDelete?: () => void;
  style?: StyleProp<ViewStyle>;
};

/** Row card for one of today's habits: icon, title, streak chip and actions. */
export function HabitCard({ habit, onProof, onDelete, style }: HabitCardProps) {
  const theme = useTheme();

  return (
    <Card style={[styles.card, style]}>
      <View style={[styles.iconTile, { backgroundColor: theme.primarySoft }]}>
        <Ionicons name={habit.icon} size={20} color={theme.primary} />
      </View>

      <View style={styles.info}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {habit.title}
        </ThemedText>
        <Chip
          label={`${habit.streakDays}d`}
          tone="red"
          icon={<Ionicons name="flame" size={11} color={theme.primary} />}
        />
      </View>

      <View style={styles.actions}>
        <Button
          label="Proof"
          size="sm"
          variant="primary"
          fullWidth={false}
          icon={<Ionicons name="camera" size={14} color={theme.onPrimary} />}
          onPress={onProof}
        />
        <Button label="Delete" size="sm" variant="text" fullWidth={false} onPress={onDelete} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 4,
    padding: Spacing.two + 6,
  },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    gap: Spacing.one + 2,
  },
  actions: {
    alignItems: 'flex-end',
    gap: Spacing.one,
  },
});
