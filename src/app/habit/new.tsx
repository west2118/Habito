import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  Button,
  FormField,
  IconOption,
  Screen,
  ScreenHeader,
  SwitchRow,
  WeekdayPicker,
} from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { demoHabitIcons, demoScheduleDays, type IoniconName } from '@/constants/demo-data';
import { useTheme } from '@/hooks/use-theme';
import { toWeekdayIndices } from '@/lib/dates';
import { createHabit, type HabitError } from '@/lib/habits';

/**
 * New habit form — writes a real `habits` row through the habits API.
 *
 * Field mapping (see `src/lib/habits/types.ts`):
 * - name            -> title
 * - icon            -> icon
 * - schedule days   -> schedule jsonb `{ target_days }`, and `type` is derived
 * - photo prompt    -> photo_prompt
 * - require photo   -> photo_mandatory
 * - require camera  -> proof_source ('camera' | 'library')
 *
 * Cadence (`type`), streak counters and `is_archived` are decided by the
 * database, not by the client, so the form cannot claim a streak it has not
 * earned.
 */
export default function NewHabitScreen() {
  const router = useRouter();
  const theme = useTheme();

  const [habitName, setHabitName] = useState('');
  const [photoPrompt, setPhotoPrompt] = useState('');
  const [photoMandatory, setPhotoMandatory] = useState(true);
  const [requireLiveCamera, setRequireLiveCamera] = useState(true);
  const [scheduleDays, setScheduleDays] = useState<number[]>(demoScheduleDays);
  const [selectedIcon, setSelectedIcon] = useState<IoniconName>(demoHabitIcons[0].icon);

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Shows a failure and stops the spinner, whatever the branch. */
  const handleError = useCallback((habitError: HabitError) => {
    setError(habitError.message);
    setIsSaving(false);
  }, []);

  const handleCreate = useCallback(async () => {
    if (isSaving) {
      return;
    }

    setError(null);
    setIsSaving(true);

    const result = await createHabit({
      title: habitName,
      icon: selectedIcon,
      // `WeekdayPicker` works in `number[]`; narrow it to the domain type.
      targetDays: toWeekdayIndices(scheduleDays),
      photoMandatory,
      photoPrompt,
      proofSource: requireLiveCamera ? 'camera' : 'library',
    });

    if (!result.ok) {
      handleError(result.error);
      return;
    }

    setIsSaving(false);
    router.back();
  }, [
    habitName,
    handleError,
    isSaving,
    photoMandatory,
    photoPrompt,
    requireLiveCamera,
    router,
    scheduleDays,
    selectedIcon,
  ]);

  return (
    <Screen scroll contentContainerStyle={styles.content}>
      <ScreenHeader
        showBack
        eyebrow="Recurring"
        title="New habit"
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

      <FormField
        label="Photo prompt (optional)"
        icon="camera"
        placeholder="e.g. Photo of your open notebook"
        helperText="Shown to you right before you snap the proof."
        value={photoPrompt}
        onChangeText={setPhotoPrompt}
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
        <ThemedText type="section">Icon</ThemedText>
      </View>
      <View style={styles.iconGrid}>
        {demoHabitIcons.map((option) => (
          <IconOption
            key={option.label}
            icon={option.icon}
            label={option.label}
            selected={selectedIcon === option.icon}
            onPress={() => setSelectedIcon(option.icon)}
            style={styles.iconOption}
          />
        ))}
      </View>

      {error !== null && (
        <ThemedText type="caption" style={[styles.error, { color: theme.primary }]}>
          {error}
        </ThemedText>
      )}

      <Button
        label={isSaving ? 'Creating…' : 'Create Habit'}
        size="lg"
        onPress={handleCreate}
        // Disabled while in flight so a double tap cannot insert two habits.
        disabled={isSaving}
        style={styles.submit}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: Spacing.two,
    gap: Spacing.three + 2,
  },
  section: {
    gap: Spacing.one,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  iconOption: {
    flexBasis: '23%',
    flexGrow: 1,
  },
  error: {
    textAlign: 'center',
  },
  submit: {
    marginTop: Spacing.two,
  },
});