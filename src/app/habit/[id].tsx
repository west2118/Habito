import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import {
  Button,
  ColorPicker,
  ConfirmModal,
  FormField,
  IconPicker,
  Screen,
  ScreenHeader,
  WeekdayPicker,
} from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { demoHabitIcons } from '@/constants/demo-data';
import { useTheme } from '@/hooks/use-theme';
import { toWeekdayIndices } from '@/lib/dates';
import {
  DEFAULT_HABIT_COLOR,
  deleteHabit,
  getHabit,
  updateHabit,
  type Habit,
  type HabitError,
} from '@/lib/habits';

/**
 * Edit habit — same fields as the New habit form, prefilled from the habit
 * row, saved through `updateHabit`. Photo proof with a live-camera shot is
 * always required, so there are no toggles for it. Also owns permanent
 * delete, so the Today card needs no buttons.
 */
export default function EditHabitScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const habitId = Array.isArray(id) ? id[0] : id;

  const [habit, setHabit] = useState<Habit | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [habitName, setHabitName] = useState('');
  const [scheduleDays, setScheduleDays] = useState<number[]>([]);
  const [selectedIcon, setSelectedIcon] = useState<string>(demoHabitIcons[0].icon);
  const [selectedColor, setSelectedColor] = useState<string>(DEFAULT_HABIT_COLOR);

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!habitId) {
        setLoadError('That habit could not be found.');
        setIsLoading(false);
        return;
      }

      const result = await getHabit(habitId);

      if (!active) {
        return;
      }

      if (!result.ok) {
        setLoadError(result.error.message);
        setIsLoading(false);
        return;
      }

      if (!result.data) {
        setLoadError('That habit could not be found.');
        setIsLoading(false);
        return;
      }

      const row = result.data;
      setHabit(row);
      setHabitName(row.title);
      setScheduleDays([...(row.schedule?.target_days ?? [])]);
      setSelectedIcon(row.icon ?? demoHabitIcons[0].icon);
      setSelectedColor(row.color ?? DEFAULT_HABIT_COLOR);
      setIsLoading(false);
    };

    void load();

    return () => {
      active = false;
    };
  }, [habitId]);

  /** Shows a failure and stops the spinner, whatever the branch. */
  const handleError = useCallback((habitError: HabitError) => {
    setError(habitError.message);
    setIsSaving(false);
    setIsDeleting(false);
  }, []);

  const goBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/today');
  }, [router]);

  const handleSave = useCallback(async () => {
    if (isSaving || !habitId) {
      return;
    }

    setError(null);
    setIsSaving(true);

    const result = await updateHabit(habitId, {
      title: habitName,
      icon: selectedIcon,
      color: selectedColor,
      // `WeekdayPicker` works in `number[]`; narrow it to the domain type.
      targetDays: toWeekdayIndices(scheduleDays),
      // Photo proof with a live-camera shot is mandatory for every habit.
      photoMandatory: true,
      proofSource: 'camera',
    });

    if (!result.ok) {
      handleError(result.error);
      return;
    }

    setIsSaving(false);
    goBack();
  }, [
    habitId,
    habitName,
    handleError,
    goBack,
    isSaving,
    scheduleDays,
    selectedColor,
    selectedIcon,
  ]);

  /** Opens the confirmation dialog; the delete itself waits for a yes. */
  const handleDeletePress = useCallback(() => {
    if (!habitId || isDeleting) {
      return;
    }

    setIsConfirmingDelete(true);
  }, [habitId, isDeleting]);

  const handleConfirmDelete = useCallback(async () => {
    if (!habitId) {
      return;
    }

    setError(null);
    setIsDeleting(true);

    const result = await deleteHabit(habitId);

    setIsDeleting(false);
    // Closed either way: on failure the message belongs on the form, not
    // behind a dialog the user has to dismiss first.
    setIsConfirmingDelete(false);

    if (!result.ok) {
      setError(result.error.message);
      return;
    }

    goBack();
  }, [goBack, habitId]);

  const handleCancelDelete = useCallback(() => {
    setIsConfirmingDelete(false);
  }, []);

  if (isLoading) {
    return (
      <Screen contentContainerStyle={styles.content}>
        <ScreenHeader showBack backFallbackHref="/today" title="Edit habit" />
        <View
          style={styles.loading}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel="Loading habit">
          <ActivityIndicator size="large" color={theme.primary} />
          <ThemedText type="caption" themeColor="textSecondary">
            Loading habit…
          </ThemedText>
        </View>
      </Screen>
    );
  }

  if (loadError !== null || habit === null) {
    return (
      <Screen contentContainerStyle={styles.content}>
        <ScreenHeader showBack backFallbackHref="/today" title="Edit habit" />
        <ThemedText type="caption" themeColor="textSecondary" style={styles.centerText}>
          {loadError ?? 'That habit could not be found.'}
        </ThemedText>
        <Button label="Back to Today" onPress={goBack} />
      </Screen>
    );
  }

  return (
    <Screen scroll contentContainerStyle={styles.content}>
      <ScreenHeader
        showBack
        backFallbackHref="/today"
        eyebrow="Recurring"
        title="Edit habit"
        subtitle="Repeats on the days you choose. Photo proof required."
      />

      <FormField
        label="Habit name"
        icon="pencil"
        placeholder="e.g. Morning Meditation"
        value={habitName}
        onChangeText={setHabitName}
      />

      <View style={styles.section}>
        <ThemedText type="section">Schedule</ThemedText>
        <ThemedText type="caption" themeColor="textSecondary">
          Which days should this habit appear?
        </ThemedText>
      </View>
      <WeekdayPicker value={scheduleDays} onChange={setScheduleDays} />

      <View style={styles.section}>
        <ThemedText type="section">Appearance</ThemedText>
        <ThemedText type="caption" themeColor="textSecondary">
          Pick an icon and the accent colour it uses.
        </ThemedText>
      </View>
      {/* Same compact pickers as the New habit form. */}
      <IconPicker value={selectedIcon} color={selectedColor} onChange={setSelectedIcon} />
      <ColorPicker value={selectedColor} onChange={setSelectedColor} />

      {error !== null && (
        <ThemedText type="caption" style={[styles.error, { color: theme.primary }]}>
          {error}
        </ThemedText>
      )}

      <Button
        label={isSaving ? 'Saving…' : 'Save changes'}
        size="lg"
        onPress={handleSave}
        // Disabled while in flight so a double tap cannot send two updates.
        disabled={isSaving || isDeleting}
        style={styles.submit}
      />

      <Button
        label="Delete habit"
        // Not the primary red: "Save changes" above is already that action, and
        // two red buttons on one screen read as equal weight. The destructive
        // emphasis lives in the confirm dialog, whose Delete button is red.
        variant="outline"
        onPress={handleDeletePress}
        disabled={isSaving || isDeleting}
      />

      <ConfirmModal
        visible={isConfirmingDelete}
        title="Delete habit?"
        message={`"${habitName}" will be permanently removed along with its history. This cannot be undone.`}
        confirmLabel="Delete"
        busyLabel="Deleting…"
        isBusy={isDeleting}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={handleCancelDelete}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: Spacing.four,
    gap: Spacing.three + 2,
  },
  section: {
    gap: Spacing.one,
  },
  error: {
    textAlign: 'center',
  },
  centerText: {
    textAlign: 'center',
  },
  loading: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.five,
  },
  submit: {
    marginTop: Spacing.two,
  },
});
