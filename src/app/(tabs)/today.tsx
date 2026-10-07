import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { Chip, Screen, ScreenHeader, SectionHeader, StatCard } from '@/components/ui';
import { HabitCard } from '@/components/habit-card';
import { StreakHeroCard } from '@/components/streak-hero-card';
import { WeekStrip } from '@/components/week-strip';
import { Spacing } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { demoHabit, demoToday, demoTodayStats, demoWeek, demoProfile } from '@/constants/demo-data';
import { useTheme } from '@/hooks/use-theme';

/** Today: greeting, streak hero, week strip, quick stats and today's habits. */
export default function TodayScreen() {
  const theme = useTheme();

  return (
    <Screen scroll tabBar>
      <View style={styles.greetingRow}>
        <ThemedText type="small" themeColor="textSecondary">
          {demoProfile.greeting}
        </ThemedText>
        <View style={[styles.bell, { backgroundColor: theme.backgroundElevated }]}>
          <Ionicons name="notifications" size={18} color={theme.text} />
          <View style={[styles.bellDot, { backgroundColor: theme.primary }]} />
        </View>
      </View>

      <ScreenHeader
        title="Today"
        subtitle={
          <View style={styles.metaRow}>
            <ThemedText type="caption" themeColor="textSecondary">
              {demoToday.dateLabel}
            </ThemedText>
            <Chip
              label={demoToday.syncLabel}
              icon={<View style={[styles.syncDot, { backgroundColor: theme.primary }]} />}
            />
          </View>
        }
      />

      <StreakHeroCard
        streakDays={demoToday.currentStreak}
        progress={demoToday.dailyProgress}
        completedHabits={demoToday.completedHabits}
        totalHabits={demoToday.totalHabits}
        message={demoToday.message}
      />

      <WeekStrip week={demoWeek} />

      <View style={styles.statsRow}>
        {demoTodayStats.map((stat) => (
          <StatCard key={stat.label} {...stat} style={styles.statTile} />
        ))}
      </View>

      <SectionHeader title="Today's Habits" badge={demoToday.totalHabits} />
      <HabitCard habit={demoHabit} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  bell: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDot: {
    position: 'absolute',
    top: 9,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.half,
  },
  syncDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  statTile: {
    flex: 1,
  },
});
