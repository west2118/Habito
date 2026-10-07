import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Card } from '@/components/ui/card';
import { Radii, Spacing } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

const WEEKDAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

export type MonthCalendarProps = {
  /** Any date inside the month that should be displayed. */
  month: Date;
  /** Day of the month outlined in red (e.g. today's proof). */
  selectedDay?: number;
  onPrevMonth?: () => void;
  onNextMonth?: () => void;
  onSelectDay?: (day: number) => void;
  style?: StyleProp<ViewStyle>;
};

/** Month grid with ‹ October 2026 › navigation, as shown on the Timeline screen. */
export function MonthCalendar({
  month,
  selectedDay,
  onPrevMonth,
  onNextMonth,
  onSelectDay,
  style,
}: MonthCalendarProps) {
  const theme = useTheme();

  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  // Convert JS Sunday-first getDay() into Monday-first indexing.
  const leadingBlanks = (new Date(year, monthIndex, 1).getDay() + 6) % 7;

  const cells: (number | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];
  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }

  const title = `${MONTH_NAMES[monthIndex]} ${year}`;

  return (
    <View style={style}>
      <View style={styles.navRow}>
        <NavButton icon="chevron-back" onPress={onPrevMonth} label="Previous month" />
        <ThemedText style={styles.monthTitle}>{title}</ThemedText>
        <NavButton icon="chevron-forward" onPress={onNextMonth} label="Next month" />
      </View>

      <Card style={styles.calendarCard}>
        <View style={styles.weekRow}>
          {WEEKDAY_LETTERS.map((letter, index) => (
            <Text key={`${letter}-${index}`} style={[styles.weekday, { color: theme.textMuted }]}>
              {letter}
            </Text>
          ))}
        </View>

        {rows.map((row, rowIndex) => (
          <View key={`week-${rowIndex}`} style={styles.dayRow}>
            {row.map((day, dayIndex) => {
              if (day === null) {
                return <View key={`blank-${dayIndex}`} style={styles.dayCell} />;
              }
              const isSelected = day === selectedDay;
              return (
                <Pressable
                  key={day}
                  accessibilityRole="button"
                  accessibilityLabel={`${title} ${day}`}
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => onSelectDay?.(day)}
                  style={({ pressed }) => [
                    styles.dayCell,
                    styles.dayButton,
                    {
                      backgroundColor: theme.backgroundElevated,
                      borderColor: isSelected ? theme.primary : 'transparent',
                      borderWidth: isSelected ? 2 : 0,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}>
                  <Text
                    style={[
                      styles.dayText,
                      { color: theme.text, fontWeight: isSelected ? '700' : '500' },
                    ]}>
                    {day}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </Card>
    </View>
  );
}

function NavButton({
  icon,
  onPress,
  label,
}: {
  icon: 'chevron-back' | 'chevron-forward';
  onPress?: () => void;
  label: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.navButton,
        { backgroundColor: theme.backgroundElevated, opacity: pressed ? 0.7 : 1 },
      ]}>
      <Ionicons name={icon} size={18} color={theme.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.two,
    marginBottom: Spacing.three,
  },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  calendarCard: {
    gap: Spacing.two,
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: Spacing.one,
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
  },
  dayRow: {
    flexDirection: 'row',
    gap: Spacing.two - 2,
  },
  dayCell: {
    flex: 1,
    height: 42,
    borderRadius: Radii.md - 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayButton: {
    overflow: 'hidden',
  },
  dayText: {
    fontSize: 13,
  },
});
