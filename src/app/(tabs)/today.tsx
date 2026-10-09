import { router, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useMemo, useRef, useState } from 'react';
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
import { ProofViewer, type ProofViewerRequest } from '@/components/proof-viewer';
import { StreakHeroCard } from '@/components/streak-hero-card';
import { WeekStrip } from '@/components/week-strip';
import { Spacing } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import {
  formatShortDate,
  getTodayIsoDate,
  toMondayFirstIndex,
  type IsoDate,
} from '@/lib/dates';
import { listHabits, type Habit } from '@/lib/habits';
import {
  completeHabitWithPhoto,
  listTodayCompletions,
  type ProofLog,
} from '@/lib/proofs';
import { listSkippedHabitIds, skipHabitForDay, unskipHabitForDay } from '@/lib/skips';

const WEEK_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

/** Builds a Mon–Sun strip for the week containing `now`, marking today. */
const buildWeek = (now: Date): { letter: string; date: number; isToday: boolean }[] => {
  // Monday-first offset: Sunday(0) -> 6, Monday(1) -> 0, ...
  const mondayFirst = (now.getDay() + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - mondayFirst);

  return WEEK_LETTERS.map((letter, index) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + index);

    return { letter, date: day.getDate(), isToday: index === mondayFirst };
  });
};

/** True when the habit is scheduled for today's Monday-first weekday. */
const isDueToday = (habit: Habit, mondayFirstToday: number): boolean => {
  const days = habit.schedule?.target_days;

  // A row without a schedule predates the jsonb column — show it rather
  // than silently hiding a habit the user created.
  if (!Array.isArray(days)) {
    return true;
  }

  return days.includes(mondayFirstToday as (typeof days)[number]);
};

/** Today: greeting, streak hero, week strip, quick stats and today's habits. */
export default function TodayScreen() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [skippedIds, setSkippedIds] = useState<ReadonlySet<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [skipError, setSkipError] = useState<string | null>(null);
  const [completions, setCompletions] = useState<ReadonlyMap<string, ProofLog>>(new Map());
  const [viewerRequest, setViewerRequest] = useState<ProofViewerRequest | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  // Tracks whether the first load has finished. Refetches on tab focus keep
  // the current list on screen instead of flashing the loading placeholder,
  // so switching back to Today stays visually stable.
  const hasLoadedRef = useRef(false);

  const loadHabits = useCallback(async () => {
    if (!hasLoadedRef.current) {
      setIsLoading(true);
    }
    setError(null);

    const todayIso = getTodayIsoDate();
    const result = await listHabits();
    // The first request has settled, so later refetches can keep the list up.
    hasLoadedRef.current = true;

    if (!result.ok) {
      // The UI shows only the safe message; log the full payload (PostgREST
      // code/status) so the next failure is diagnosable from the console.
      if (__DEV__) {
        console.warn('[Today] listHabits failed:', result.error);
      }
      setError(result.error.message);
      setIsLoading(false);
      return;
    }

    setHabits(result.data);

    // Skip state lives in `habit_logs`, so it needs its own read. A failure
    // here must not wipe the habit list — the cards simply render unskipped.
    const skips = await listSkippedHabitIds(
      result.data.map((habit) => habit.id),
      todayIso,
    );

    if (!skips.ok) {
      if (__DEV__) {
        console.warn('[Today] listSkippedHabitIds failed:', skips.error);
      }
    } else {
      setSkippedIds(new Set(skips.data));
    }

    // Completion state lives in `habit_logs` too. Failures here must not wipe
    // the habit list — the cards simply render as pending.
    const done = await listTodayCompletions(
      result.data.map((habit) => habit.id),
      todayIso,
    );

    if (!done.ok) {
      if (__DEV__) {
        console.warn('[Today] listTodayCompletions failed:', done.error);
      }
    } else {
      setCompletions(done.data);
    }

    setIsLoading(false);
  }, []);

  // Refetch every time the tab regains focus — this is what makes a habit
  // created or edited on a pushed screen appear after `router.back()`.
  useFocusEffect(
    useCallback(() => {
      void loadHabits();
    }, [loadHabits]),
  );

  const todayIso: IsoDate = useMemo(() => getTodayIsoDate(), []);
  const mondayFirstToday = useMemo(() => toMondayFirstIndex(new Date().getDay()), []);
  const week = useMemo(() => buildWeek(new Date()), []);
  const dateLabel = useMemo(() => formatShortDate(todayIso), [todayIso]);

  const dueToday = useMemo(
    () => habits.filter((habit) => !habit.is_archived && isDueToday(habit, mondayFirstToday)),
    [habits, mondayFirstToday],
  );
  const activeHabits = useMemo(
    () => dueToday.filter((habit) => !skippedIds.has(habit.id)),
    [dueToday, skippedIds],
  );
  const skippedHabits = useMemo(
    () => dueToday.filter((habit) => skippedIds.has(habit.id)),
    [dueToday, skippedIds],
  );
  /** Habits with a completed log row today — no swipe, proof button instead. */
  const completedHabits = useMemo(
    () => activeHabits.filter((habit) => completions.has(habit.id)),
    [activeHabits, completions],
  );
  const pendingHabits = useMemo(
    () => activeHabits.filter((habit) => !completions.has(habit.id)),
    [activeHabits, completions],
  );

  const currentStreak = useMemo(
    () => activeHabits.reduce((max, habit) => Math.max(max, habit.streak_current ?? 0), 0),
    [activeHabits],
  );

  const handleSkip = useCallback(async (habitId: string) => {
    setSkipError(null);
    setSkippedIds((current) => new Set(current).add(habitId));

    const result = await skipHabitForDay(habitId);

    if (!result.ok) {
      // Roll back the optimistic mark so the card matches the database.
      setSkippedIds((current) => {
        const next = new Set(current);
        next.delete(habitId);
        return next;
      });
      setSkipError(result.error.message);
    }
  }, []);

  const handleUnskip = useCallback(async (habitId: string) => {
    setSkipError(null);
    setSkippedIds((current) => {
      const next = new Set(current);
      next.delete(habitId);
      return next;
    });

    const result = await unskipHabitForDay(habitId);

    if (!result.ok) {
      setSkippedIds((current) => new Set(current).add(habitId));
      setSkipError(result.error.message);
    }
  }, []);

  const handlePress = useCallback((habitId: string) => {
    router.push({ pathname: '/habit/[id]', params: { id: habitId } });
  }, []);

  /**
   * Swipe right-to-left goes straight into the camera — no intermediate
   * page. The system camera UI already ends the flow with Retake (X) /
   * Use Photo (check): dismissing stays on Today, confirming uploads the
   * shot and marks the habit done.
   */
  const handleProof = useCallback(
    async (habitId: string) => {
      if (uploadingId !== null) {
        return;
      }

      setSkipError(null);

      const permission = await ImagePicker.requestCameraPermissionsAsync();

      if (!permission.granted) {
        setSkipError('Camera access was denied. Allow it in Settings to take a proof photo.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });

      if (result.canceled) {
        return;
      }

      const uri = result.assets[0]?.uri;

      if (!uri) {
        return;
      }

      setUploadingId(habitId);

      const completed = await completeHabitWithPhoto(habitId, uri);

      setUploadingId(null);

      if (!completed.ok) {
        if (__DEV__) {
          console.warn('[Today] completeHabitWithPhoto failed:', completed.error);
        }
        setSkipError(completed.error.message);
        return;
      }

      setCompletions((current) => new Map(current).set(habitId, completed.data));
      // A completion supersedes a skip for the day.
      setSkippedIds((current) => {
        if (!current.has(habitId)) {
          return current;
        }

        const next = new Set(current);
        next.delete(habitId);
        return next;
      });
    },
    [uploadingId],
  );

  const handleViewProof = useCallback(
    (habitId: string) => {
      const habit = habits.find((row) => row.id === habitId);
      const proof = completions.get(habitId);

      if (!habit || !proof?.photo_path) {
        return;
      }

      setViewerRequest({ title: habit.title, photoPath: proof.photo_path });
    },
    [completions, habits],
  );

  const handleCloseViewer = useCallback(() => {
    setViewerRequest(null);
  }, []);

  const renderCard = useCallback(
    (habit: Habit, skipped: boolean, completed: boolean) => (
      <HabitCard
        key={habit.id}
        habit={{
          title: habit.title,
          icon: habit.icon ?? 'flag',
          streakDays: habit.streak_current ?? 0,
          color: habit.color,
        }}
        skipped={skipped}
        completed={completed}
        onPress={() => handlePress(habit.id)}
        onSkip={() => void handleSkip(habit.id)}
        onUnskip={() => void handleUnskip(habit.id)}
        onProof={() => void handleProof(habit.id)}
        onViewProof={() => handleViewProof(habit.id)}
      />
    ),
    [handlePress, handleProof, handleSkip, handleUnskip, handleViewProof],
  );

  return (
    <Screen scroll tabBar>
      <ScreenHeader title="Today" subtitle={dateLabel} />

      <StreakHeroCard
        streakDays={currentStreak}
        progress={activeHabits.length === 0 ? 0 : completedHabits.length / activeHabits.length}
        completedHabits={completedHabits.length}
        totalHabits={activeHabits.length}
        message={activeHabits.length === 0 ? 'Create your first habit' : "Let's crush today"}
      />

      <WeekStrip week={week} />

      <SectionHeader title="Today's Habits" badge={pendingHabits.length} />

      {skipError !== null && (
        <ThemedText type="caption" themeColor="textSecondary" style={styles.centerText}>
          {skipError}
        </ThemedText>
      )}

      {uploadingId !== null && (
        <ThemedText type="caption" themeColor="textSecondary" style={styles.centerText}>
          Uploading proof…
        </ThemedText>
      )}

      {isLoading ? (
        <View style={styles.listBlock}>
          {[0, 1, 2].map((row) => (
            <HabitCardSkeleton key={row} index={row} />
          ))}
        </View>
      ) : error !== null && dueToday.length === 0 ? (
        <View style={styles.errorBlock}>
          <ThemedText type="caption" themeColor="textSecondary" style={styles.centerText}>
            {error}
          </ThemedText>
          <Button label="Retry" size="sm" fullWidth={false} onPress={() => void loadHabits()} />
        </View>
      ) : dueToday.length === 0 ? (
        <View style={styles.emptyBlock}>
          <EmptyState
            icon="flag"
            message="No habits due today. Create one to get started."
          />
          <Button label="Create habit" onPress={() => router.push('/habit/new')} />
        </View>
      ) : (
        <View style={styles.listBlock}>
          {error !== null && (
            <View style={styles.errorBlock}>
              <ThemedText type="caption" themeColor="textSecondary" style={styles.centerText}>
                {error}
              </ThemedText>
              <Button label="Retry" size="sm" fullWidth={false} onPress={() => void loadHabits()} />
            </View>
          )}
          {pendingHabits.map((habit) => renderCard(habit, false, false))}
          {completedHabits.length > 0 && (
            <View style={styles.skippedSection}>
              <ThemedText type="caption" themeColor="textMuted">
                Done today — tap Proof to view
              </ThemedText>
              {completedHabits.map((habit) => renderCard(habit, false, true))}
            </View>
          )}
          {skippedHabits.length > 0 && (
            <View style={styles.skippedSection}>
              <ThemedText type="caption" themeColor="textMuted">
                Skipped today — swipe right to bring back
              </ThemedText>
              {skippedHabits.map((habit) => renderCard(habit, true, false))}
            </View>
          )}
        </View>
      )}

      <ProofViewer request={viewerRequest} onClose={handleCloseViewer} />
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
  listBlock: {
    gap: Spacing.two,
  },
  skippedSection: {
    gap: Spacing.two,
  },
});
