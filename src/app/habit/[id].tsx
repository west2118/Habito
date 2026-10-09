import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import {
  Button,
  ColorPicker,
  FormField,
  IconPicker,
  Screen,
  ScreenHeader,
  SwitchRow,
  WeekdayPicker,
} from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { demoHabitIcons } from '@/constants/demo-data';
import { useTheme } from '@/hooks/use-theme';
import { toWeekdayIndices } from '@/lib/dates';
import {
  DEFAULT_HABIT_COLOR,
  archiveHabit,
  deleteHabit,
  getHabit,
  unarchiveHabit,
  updateHabit,
  type Habit,
  type HabitError,
} from '@/lib/habits';

/**
 * Edit habit — same fields as the New habit form, prefilled from the habit
 * row, saved through `updateHabit`. Also owns archive/restore and permanent
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
  const [photoMandatory, setPhotoMandatory] = useState(true);
  const [requireLiveCamera, setRequireLiveCamera] = useState(true);
  const [scheduleDays, setScheduleDays] = useState<number[]>([]);
  const [selectedIcon, setSelectedIcon] = useState<string>(demoHabitIcons[0].icon);
  const [selectedColor, setSelectedColor] = useState<string>(DEFAULT_HABIT_COLOR);

  const [isSaving, setIsSaving] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
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
      setPhotoMandatory(row.photo_mandatory);
      setRequireLiveCamera(row.proof_source !== 'library');
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
    setIsArchiving(false);
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
      photoMandatory,
      proofSource: requireLiveCamera ? 'camera' : 'library',
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
    photoMandatory,
    requireLiveCamera,
    scheduleDays,
    selectedColor,
    selectedIcon,
  ]);

  const handleToggleArchive = useCallback(async () => {
    if (isArchiving || !habitId || !habit) {
      return;
    }

    setError(null);
    setIsArchiving(true);

    const result = habit.is_archived
      ? await unarchiveHabit(habitId)
      : await archiveHabit(habitId);

    if (!result.ok) {
      handleError(result.error);
      return;
    }

    setIsArchiving(false);
    goBack();
  }, [goBack, habit, habitId, handleError, isArchiving]);

  const handleDelete = useCallback(() => {
    if (!habitId) {
      return;
    }

    Alert.alert(
      'Delete habit?',
      'This permanently removes the habit and its history. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              const result = await deleteHabit(habitId);

              if (!result.ok) {
                setError(result.error.message);
                return;
              }

              goBack();
            })();
          },
        },
      ],
    );
  }, [goBack, habitId]);

  if (isLoading) {
    return (
      <Screen contentContainerStyle={styles.content}>
        <ScreenHeader showBack backFallbackHref="/today" title="Edit habit" />
        <ThemedText type="caption" themeColor="textSecondary" style={styles.centerText}>
          Loading habit…
        </ThemedText>
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
        subtitle={
          photoMandatory
            ? 'Repeats on the days you choose. Photo proof required.'
            : 'Repeats on the days you choose. No photo needed.'
        }
      />

      <FormField
        label="Habit name"
        icon="pencil"
        placeholder="e.g. Morning Meditation"
        value={habitName}
        onChangeText={setHabitName}
      />

      <SwitchRow
        title="Require photo proof"
        description="Turn off to log the habit with just a tap."
        value={photoMandatory}
        onValueChange={setPhotoMandatory}
      />

      <SwitchRow
        title="Require a live camera"
        description="Turn off to allow picking from your library."
        value={requireLiveCamera}
        onValueChange={setRequireLiveCamera}
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
        disabled={isSaving || isArchiving}
        style={styles.submit}
      />

      <Button
        label={
          isArchiving ? 'Working…' : habit.is_archived ? 'Restore habit' : 'Archive habit'
        }
        variant="outline"
        onPress={handleToggleArchive}
        disabled={isSaving || isArchiving}
      />

      <Button label="Delete habit" variant="text" onPress={handleDelete} />
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
  submit: {
    marginTop: Spacing.two,
  },
});
