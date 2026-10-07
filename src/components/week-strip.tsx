import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Card } from '@/components/ui';
import { Radii, Spacing } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import type { WeekDay } from '@/constants/demo-data';

export type WeekStripProps = {
  week: WeekDay[];
  style?: StyleProp<ViewStyle>;
};

/** "This Week" card with the Mon–Sun date circles (today filled red). */
export function WeekStrip({ week, style }: WeekStripProps) {
  const theme = useTheme();

  return (
    <Card style={style}>
      <View style={styles.header}>
        <ThemedText type="section">This Week</ThemedText>
        <ThemedText type="caption" themeColor="textMuted">
          proofs logged
        </ThemedText>
      </View>

      <View style={styles.days}>
        {week.map((day, index) => (
          <View key={`${day.letter}-${index}`} style={styles.day}>
            <ThemedText type="caption" themeColor="textMuted" style={styles.letter}>
              {day.letter}
            </ThemedText>
            <View
              style={[
                styles.circle,
                { backgroundColor: day.isToday ? theme.primary : theme.backgroundElevated },
              ]}>
              <Text style={[styles.date, { color: theme.text }]}>{day.date}</Text>
            </View>
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  days: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.two,
  },
  day: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  letter: {
    fontSize: 11,
    fontWeight: '600',
  },
  circle: {
    width: 36,
    height: 36,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  date: {
    fontSize: 13,
    fontWeight: '600',
  },
});
