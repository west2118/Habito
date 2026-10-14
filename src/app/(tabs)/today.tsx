import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

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
import { WeekStrip, type WeekStripDay } from '@/components/week-strip';
import { Spacing } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import {
  addDays,
  formatShortDate,
  getTodayIsoDate,
  getWeekdayIndex,
  type IsoDate,
} from '@/lib/dates';
import { listHabits, type Habit } from '@/lib/habits';
import {
  completeHabitWithPhoto,
  listDayActivity,
  listTodayCompletions,
  type DayActivity,
  type ProofLog,
} from '@/lib/proofs';
import { listSkippedHabitIds, skipHabitForDay, unskipHabitForDay } from '@/lib/skips';

const WEEK_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

/**
 * Builds a Mon–Sun strip for the week containing `todayIso`, marking today.
 *
 * Dates come from the timezone-aware helpers rather than local `Date` math,
 * so the cell a user taps always matches the `log_date` the database would
 * use for that day.
 */
const buildWeek = (todayIso: IsoDate): WeekStripDay[] => {
  const mondayIso = addDays(todayIso, -getWeekdayIndex(todayIso));

  return WEEK_LETTERS.map((letter, index) => {
    const iso = addDays(mondayIso, index);

    return {
      letter,
      date: Number(iso.slice(8, 10)),
      iso,
      isToday: iso === todayIso,
    };
  });
};

/** True when the habit is scheduled for the given Monday-first weekday. */
const isDueOn = (habit: Habit, mondayFirstWeekday: number): boolean => {
  const days = habit.schedule?.target_days;

  // A row without a schedule predates the jsonb column — show it rather
  // than silently hiding a habit the user created.
  if (!Array.isArray(days)) {
    return true;
  }

  return days.includes(mondayFirstWeekday as (typeof days)[number]);
};

/** Today: greeting, streak hero, week strip, quick stats and today's habits. */
export default function TodayScreen() {
  const theme = useTheme();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [skippedIds, setSkippedIds] = useState<ReadonlySet<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [skipError, setSkipError] = useState<string | null>(null);
  const [completions, setCompletions] = useState<ReadonlyMap<string, ProofLog>>(new Map());
  const [viewerRequest, setViewerRequest] = useState<ProofViewerRequest | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  // The week strip selects a day to preview. Today is the default and the
  // only day with live swipe actions.
  const [selectedIso, setSelectedIso] = useState<IsoDate>(() => getTodayIsoDate());
  const [dayLogs, setDayLogs] = useState<DayActivity[]>([]);
  const [isDayLoading, setIsDayLoading] = useState(false);
  const [dayError, setDayError] = useState<string | null>(null);
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
  const mondayFirstToday = useMemo(() => getWeekdayIndex(todayIso), [todayIso]);
  const week = useMemo(() => buildWeek(todayIso), [todayIso]);
  const dateLabel = useMemo(() => formatShortDate(todayIso), [todayIso]);
  const selectedLabel = useMemo(() => formatShortDate(selectedIso), [selectedIso]);
  const selectedWeekday = useMemo(() => getWeekdayIndex(selectedIso), [selectedIso]);
  const isTodaySelected = selectedIso === todayIso;

  const dueToday = useMemo(
    () => habits.filter((habit) => !habit.is_archived && isDueOn(habit, mondayFirstToday)),
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

  /** Tracks the newest day read, so a slow one cannot overwrite a later pick. */
  const dayRequestRef = useRef(0);

  /**
   * Reads one day's logs. Driven by the strip's press handler rather than an
   * effect, so nothing sets state synchronously during render or an effect.
   */
  const loadDayLogs = useCallback(async (iso: IsoDate) => {
    const requestId = dayRequestRef.current + 1;
    dayRequestRef.current = requestId;
    setDayError(null);
    setIsDayLoading(true);

    const result = await listDayActivity(iso);

    // A newer selection landed while this read was in flight — drop it.
    if (requestId !== dayRequestRef.current) {
      return;
    }

    if (!result.ok) {
      if (__DEV__) {
        console.warn('[Today] listDayActivity failed:', result.error);
      }
      setDayError(result.error.message);
      setIsDayLoading(false);
      return;
    }

    setDayLogs(result.data);
    setIsDayLoading(false);
  }, []);

  /** Selecting a day previews it; today falls back to the live list above. */
  const handleSelectDay = useCallback(
    (iso: IsoDate) => {
      setSelectedIso(iso);

      if (iso === todayIso) {
        // Today's rows come from the live maps, so there is nothing to read.
        dayRequestRef.current += 1;
        setDayLogs([]);
        setDayError(null);
        setIsDayLoading(false);
        return;
      }

      void loadDayLogs(iso);
    },
    [loadDayLogs, todayIso],
  );

  /** Logged state per habit for the selected day. */
  const dayStatusByHabit = useMemo(
    () => new Map(dayLogs.map((log) => [log.habitId, log.status])),
    [dayLogs],
  );

  /**
   * Rows for a non-today selection: every habit scheduled that weekday, plus
   * anything logged that day (a habit logged off its schedule still shows).
   * Sorted pending → done → skipped, mirroring the Today list's grouping.
   */
  const selectedDayRows = useMemo(() => {
    if (isTodaySelected) {
      return [];
    }

    const scheduled = habits.filter(
      (habit) => !habit.is_archived && isDueOn(habit, selectedWeekday),
    );
    const scheduledIds = new Set(scheduled.map((habit) => habit.id));
    const loggedOffSchedule = dayLogs
      .filter((log) => !scheduledIds.has(log.habitId))
      .map((log) => habits.find((habit) => habit.id === log.habitId))
      .filter((habit): habit is Habit => habit !== undefined && !habit.is_archived);
    const rank = (habit: Habit) => {
      const status = dayStatusByHabit.get(habit.id);

      return status === 'completed' ? 1 : status === 'skipped' ? 2 : 0;
    };

    return [...scheduled, ...loggedOffSchedule].sort((a, b) => rank(a) - rank(b));
  }, [dayLogs, dayStatusByHabit, habits, isTodaySelected, selectedWeekday]);

  /**
   * Mirrors the database streak trigger locally so the card updates the
   * moment the action lands instead of waiting for the next refetch (which
   * converges any drift on focus).
   */
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
      return;
    }

    // Skipping breaks the streak: no increment, straight to zero.
    resetLocalStreak(habitId);
  }, [resetLocalStreak]);

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
      return;
    }

    // No streak change: skipping already zeroed it, and unskipping only
    // re-opens the day. Completing the day still adds +1 from there.
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

      // Deleting the prior skip changes nothing; the completion adds +1, even
      // when the streak was zeroed by the skip. A fresh completion is +1 too.
      bumpLocalStreak(habitId, 1);

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
    [bumpLocalStreak, uploadingId],
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

  /**
   * Row for a previewed day. Skip and proof only apply to the live day, so
   * these rows carry no gestures and no proof button — tapping opens the
   * editor, which is the only sensible action on a past or future date.
   */
  const renderDayRow = useCallback(
    (habit: Habit) => {
      const status = dayStatusByHabit.get(habit.id);

      return (
        <HabitCard
          key={habit.id}
          habit={{
            title: habit.title,
            icon: habit.icon ?? 'flag',
            streakDays: habit.streak_current ?? 0,
            color: habit.color,
          }}
          skipped={status === 'skipped'}
          completed={status === 'completed'}
          swipeable={false}
          onPress={() => handlePress(habit.id)}
        />
      );
    },
    [dayStatusByHabit, handlePress],
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

      <WeekStrip week={week} selectedIso={selectedIso} onSelectDay={handleSelectDay} />

      {isTodaySelected ? (
        <>
          <SectionHeader
            title="Today's Habits"
            badge={pendingHabits.length}
            trailing={
              <Pressable
                accessibilityRole="link"
                accessibilityLabel="View all habits"
                onPress={() => router.push('/habits')}
                hitSlop={8}>
                <ThemedText type="captionBold" themeColor="primary">
                  View all
                </ThemedText>
              </Pressable>
            }
          />

          {/* Only once the day is fully resolved — every habit done or skipped —
          and only when at least one habit was actually completed (a collage
          needs proof photos, so all-skipped shows nothing). */}
          {!isLoading && pendingHabits.length === 0 && completedHabits.length > 0 && (
            <Button
              label="Generate collage"
              variant="outline"
              icon={<Ionicons name="images" size={18} color={theme.text} />}
              onPress={() => router.push('/collage')}
            />
          )}

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
              <Button label="Create habit" onPress={() => router.push('/habit/pick')} />
            </View>
          ) : (
            <View style={styles.listBlock}>
              {error !== null && (
                <View style={styles.errorBlock}>
                  <ThemedText type="caption" themeColor="textSecondary" style={styles.centerText}>
                    {error}
                  </ThemedText>
                  <Button
                    label="Retry"
                    size="sm"
                    fullWidth={false}
                    onPress={() => void loadHabits()}
                  />
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
        </>
      ) : (
        <>
          <SectionHeader
            title="Habits"
            trailing={
              <ThemedText type="captionBold" themeColor="primary">
                {selectedLabel}
              </ThemedText>
            }
          />

          {isDayLoading ? (
            <View style={styles.listBlock}>
              {[0, 1, 2].map((row) => (
                <HabitCardSkeleton key={row} index={row} />
              ))}
            </View>
          ) : dayError !== null && selectedDayRows.length === 0 ? (
            <View style={styles.errorBlock}>
              <ThemedText type="caption" themeColor="textSecondary" style={styles.centerText}>
                {dayError}
              </ThemedText>
              <Button
                label="Retry"
                size="sm"
                fullWidth={false}
                onPress={() => void loadDayLogs(selectedIso)}
              />
            </View>
          ) : selectedDayRows.length === 0 ? (
            <EmptyState icon="calendar" message={`No habits scheduled for ${selectedLabel}.`} />
          ) : (
            <View style={styles.listBlock}>
              {selectedDayRows.map(renderDayRow)}
            </View>
          )}
        </>
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
