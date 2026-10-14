import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Card } from '@/components/ui';
import { Radii, Spacing } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import type { IsoDate } from '@/lib/dates';

export type WeekStripDay = {
  letter: string;
  date: number;
  /** ISO date this cell stands for — what `onSelectDay` hands back. */
  iso: IsoDate;
  isToday: boolean;
};

export type WeekStripProps = {
  week: WeekStripDay[];
  /** Currently selected ISO date; drives the cell highlight. */
  selectedIso: IsoDate;
  onSelectDay: (iso: IsoDate) => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * "This Week" card with the Mon–Sun date circles. Each circle selects its
 * day, so the screen below can preview a date other than today.
 */
export function WeekStrip({ week, selectedIso, onSelectDay, style }: WeekStripProps) {
  const theme = useTheme();

  return (
    <Card style={style}>
      <View style={styles.header}>
        <ThemedText type="section">This Week</ThemedText>
      </View>

      <View style={styles.days}>
        {week.map((day) => {
          const isSelected = day.iso === selectedIso;
          // Today keeps the brand fill; another selected day gets the muted
          // surface plus accent text, so the two states never look alike.
          const backgroundColor = day.isToday
            ? theme.primary
            : isSelected
              ? theme.backgroundSelected
              : theme.backgroundElevated;

          return (
            <Pressable
              key={day.iso}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${day.letter} ${day.date}, show habits`}
              hitSlop={4}
              onPress={() => onSelectDay(day.iso)}
              style={styles.day}>
              <ThemedText type="caption" themeColor="textMuted" style={styles.letter}>
                {day.letter}
              </ThemedText>
              <View style={[styles.circle, { backgroundColor }]}>
                <Text
                  style={[
                    styles.date,
                    {
                      color: day.isToday
                        ? theme.onPrimary
                        : isSelected
                          ? theme.primary
                          : theme.text,
                    },
                  ]}>
                  {day.date}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
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
