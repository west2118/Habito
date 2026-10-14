import { router, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
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
import { ProofViewer, type ProofViewerRequest } from '@/components/proof-viewer';
import { Spacing } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { getTodayIsoDate } from '@/lib/dates';
import { listHabits, type Habit } from '@/lib/habits';
import {
  completeHabitWithPhoto,
  listTodayCompletions,
  type ProofLog,
} from '@/lib/proofs';
import { listSkippedHabitIds, skipHabitForDay, unskipHabitForDay } from '@/lib/skips';

/**
 * All habits — every active habit, not just today's. Same card gestures as
 * Today (tap to edit, swipe right to skip for today, swipe left for photo
 * proof), since skip/proof are day-scoped and valid from here too.
 */
export default function AllHabitsScreen() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [skippedIds, setSkippedIds] = useState<ReadonlySet<string>>(new Set());
  const [completions, setCompletions] = useState<ReadonlyMap<string, ProofLog>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [viewerRequest, setViewerRequest] = useState<ProofViewerRequest | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

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

    const [skips, done] = await Promise.all([
      listSkippedHabitIds(ids, todayIso),
      listTodayCompletions(ids, todayIso),
    ]);

    if (!skips.ok) {
      if (__DEV__) {
        console.warn('[Habits] listSkippedHabitIds failed:', skips.error);
      }
    } else {
      setSkippedIds(new Set(skips.data));
    }

    if (!done.ok) {
      if (__DEV__) {
        console.warn('[Habits] listTodayCompletions failed:', done.error);
      }
    } else {
      setCompletions(done.data);
    }

    setIsLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const bumpLocalStreak = useCallback((habitId: string, delta: 1 | -1) => {
    setHabits((current) =>
      current.map((habit) => {
        if (habit.id !== habitId) {
          return habit;
        }

        const streakCurrent = Math.max((habit.streak_current ?? 0) + delta, 0);

        return {
          ...habit,
          streak_current: streakCurrent,
          streak_longest: Math.max(habit.streak_longest ?? 0, streakCurrent),
        };
      }),
    );
  }, []);

  /**
   * Mirrors a skip locally: skipping breaks the streak, so the counter resets
   * to zero while the longest streak is preserved.
   */
  const resetLocalStreak = useCallback((habitId: string) => {
    setHabits((current) =>
      current.map((habit) =>
        habit.id !== habitId ? habit : { ...habit, streak_current: 0 },
      ),
    );
  }, []);

  const handleSkip = useCallback(
    async (habitId: string) => {
      setActionError(null);
      setSkippedIds((current) => new Set(current).add(habitId));

      const result = await skipHabitForDay(habitId);

      if (!result.ok) {
        setSkippedIds((current) => {
          const next = new Set(current);
          next.delete(habitId);
          return next;
        });
        setActionError(result.error.message);
        return;
      }

      // Skipping breaks the streak: no increment, straight to zero.
      resetLocalStreak(habitId);
    },
    [resetLocalStreak],
  );

  const handleUnskip = useCallback(
    async (habitId: string) => {
      setActionError(null);
      setSkippedIds((current) => {
        const next = new Set(current);
        next.delete(habitId);
        return next;
      });

      const result = await unskipHabitForDay(habitId);

      if (!result.ok) {
        setSkippedIds((current) => new Set(current).add(habitId));
        setActionError(result.error.message);
        return;
      }

      // No streak change: skipping already zeroed it, and unskipping only
      // re-opens the day. Completing the day still adds +1 from there.
    },
    [],
  );

  const handleProof = useCallback(
    async (habitId: string) => {
      if (uploadingId !== null) {
        return;
      }

      setActionError(null);

      const permission = await ImagePicker.requestCameraPermissionsAsync();

      if (!permission.granted) {
        setActionError('Camera access was denied. Allow it in Settings to take a proof photo.');
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
          console.warn('[Habits] completeHabitWithPhoto failed:', completed.error);
        }
        setActionError(completed.error.message);
        return;
      }

      setCompletions((current) => new Map(current).set(habitId, completed.data));

      // Deleting the prior skip changes nothing; the completion adds +1, even
      // when the streak was zeroed by the skip. A fresh completion is +1 too.
      bumpLocalStreak(habitId, 1);

      setSkippedIds((current) => {
        if (!current.has(habitId)) {
          return current;
        }

        const next = new Set(current);
        next.delete(habitId);
        return next;
      });
    },
    [bumpLocalStreak, uploadingId],
  );

  const handlePress = useCallback((habitId: string) => {
    router.push({ pathname: '/habit/[id]', params: { id: habitId } });
  }, []);

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

  const activeCount = useMemo(() => habits.filter((habit) => !habit.is_archived).length, [habits]);

  return (
    <Screen scroll>
      <ScreenHeader
        showBack
        backFallbackHref="/today"
        title="All habits"
        subtitle={`${activeCount} active`}
      />

      {actionError !== null && (
        <ThemedText type="caption" themeColor="textSecondary" style={styles.centerText}>
          {actionError}
        </ThemedText>
      )}

      {uploadingId !== null && (
        <ThemedText type="caption" themeColor="textSecondary" style={styles.centerText}>
          Uploading proof…
        </ThemedText>
      )}

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
                  streakDays: habit.streak_current ?? 0,
                  color: habit.color,
                }}
                skipped={skippedIds.has(habit.id)}
                completed={completions.has(habit.id)}
                onPress={() => handlePress(habit.id)}
                onSkip={() => void handleSkip(habit.id)}
                onUnskip={() => void handleUnskip(habit.id)}
                onProof={() => void handleProof(habit.id)}
                onViewProof={() => handleViewProof(habit.id)}
              />
            ))}
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
  list: {
    gap: Spacing.two,
  },
});
