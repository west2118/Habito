import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  Button,
  EmptyState,
  Screen,
  ScreenHeader,
  SectionHeader,
} from '@/components/ui';
import { HabitCard } from '@/components/habit-card';
import { HabitCardSkeleton } from '@/components/habit-card-skeleton';
import { Spacing } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { addDays, getTodayIsoDate, type IsoDate } from '@/lib/dates';
import { listHabits, type Habit } from '@/lib/habits';
import { listCompletionDatesByHabit } from '@/lib/proofs';
import { STREAK_LOOKBACK_DAYS, getEffectiveStreakCurrent } from '@/lib/streaks';

/**
 * All habits — a clean overview for viewing all active habits.
 * Read-only cards without skip or proof swipe gestures; tapping opens habit details.
 */
export default function AllHabitsScreen() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recentCompletions, setRecentCompletions] = useState<ReadonlyMap<
    string,
    ReadonlySet<IsoDate>
  > | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const todayIso = getTodayIsoDate();
    const result = await listHabits();

    if (!result.ok) {
      if (__DEV__) {
        console.warn('[Habits] listHabits failed:', result.error);
      }
      setError(result.error.message);
      setIsLoading(false);
      return;
    }

    setHabits(result.data);
    const ids = result.data.map((habit) => habit.id);

    const recent = await listCompletionDatesByHabit(
      ids,
      addDays(todayIso, -(STREAK_LOOKBACK_DAYS - 1)),
      todayIso,
    );

    if (!recent.ok) {
      if (__DEV__) {
        console.warn('[Habits] listCompletionDatesByHabit failed:', recent.error);
      }
    } else {
      setRecentCompletions(recent.data);
    }

    setIsLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const handlePress = useCallback((habitId: string) => {
    router.push({ pathname: '/habit/[id]', params: { id: habitId } });
  }, []);

  const activeCount = useMemo(() => habits.filter((habit) => !habit.is_archived).length, [habits]);

  const effectiveStreaks = useMemo(() => {
    if (recentCompletions === null) {
      return null;
    }

    const todayIso = getTodayIsoDate();
    const map = new Map<string, number>();

    for (const habit of habits) {
      const dates = new Set(recentCompletions.get(habit.id) ?? []);
      map.set(habit.id, getEffectiveStreakCurrent(habit, todayIso, dates));
    }

    return map;
  }, [habits, recentCompletions]);

  return (
    <Screen scroll>
      <ScreenHeader
        showBack
        backFallbackHref="/today"
        title="All habits"
        subtitle={`${activeCount} active`}
      />

      {isLoading ? (
        <View style={styles.list}>
          {[0, 1, 2].map((row) => (
            <HabitCardSkeleton key={row} index={row} />
          ))}
        </View>
      ) : error !== null && habits.length === 0 ? (
        <View style={styles.errorBlock}>
          <ThemedText type="caption" themeColor="textSecondary" style={styles.centerText}>
            {error}
          </ThemedText>
          <Button label="Retry" size="sm" fullWidth={false} onPress={() => void load()} />
        </View>
      ) : habits.length === 0 ? (
        <View style={styles.emptyBlock}>
          <EmptyState icon="flag" message="No habits yet. Create one to get started." />
          <Button label="Create habit" onPress={() => router.push('/habit/pick')} />
        </View>
      ) : (
        <View style={styles.list}>
          <SectionHeader title="Active" badge={activeCount} />
          {habits
            .filter((habit) => !habit.is_archived)
            .map((habit) => (
              <HabitCard
                key={habit.id}
                habit={{
                  title: habit.title,
                  icon: habit.icon ?? 'flag',
                  streakDays: effectiveStreaks?.get(habit.id) ?? (habit.streak_current ?? 0),
                  color: habit.color,
                }}
                swipeable={false}
                onPress={() => handlePress(habit.id)}
              />
            ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  centerText: {
    textAlign: 'center',
  },
  errorBlock: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  emptyBlock: {
    gap: Spacing.two,
  },
  list: {
    gap: Spacing.two,
  },
});
