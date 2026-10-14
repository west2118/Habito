import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  Button,
  ColorPicker,
  FormField,
  IconPicker,
  Screen,
  ScreenHeader,
  WeekdayPicker,
} from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { demoHabitIcons, demoScheduleDays } from '@/constants/demo-data';
import { useTheme } from '@/hooks/use-theme';
import { toWeekdayIndices } from '@/lib/dates';
import { DEFAULT_HABIT_COLOR, createHabit, newHabitIdempotencyKey, type HabitError } from '@/lib/habits';

/**
 * New habit form — writes a real `habits` row through the habits API.
 *
 * Photo proof and live-camera capture are always required: every habit logs
 * completion with a fresh camera photo, so the form offers no toggles for
 * them.
 *
 * Field mapping (see `src/lib/habits/types.ts`):
 * - name            -> title
 * - icon            -> icon
 * - accent colour   -> color
 * - schedule days   -> schedule jsonb `{ target_days }`, and `type` is derived
 *
 * `photo_mandatory` is always `true` and `proof_source` is always `'camera'`.
 * Cadence (`type`), streak counters and `is_archived` are decided by the
 * database, not by the client, so the form cannot claim a streak it has not
 * earned.
 *
 * Accepts optional `title`, `icon`, `color` and `days` route params so the
 * "Pick a New One" gallery can prefill the form from a preset: the name, icon
 * and colour arrive filled in, and `days` (comma-separated `0–6`) becomes the
 * initial schedule the user can still change.
 */
export default function NewHabitScreen() {
  const router = useRouter();
  const theme = useTheme();
  const params = useLocalSearchParams<{ title?: string; icon?: string; color?: string; days?: string }>();

  const [habitName, setHabitName] = useState(() => firstParam(params.title) ?? '');
  const [scheduleDays, setScheduleDays] = useState<number[]>(() => parseDaysParam(firstParam(params.days)));
  const [selectedIcon, setSelectedIcon] = useState<string>(
    () => firstParam(params.icon) || demoHabitIcons[0].icon,
  );
  const [selectedColor, setSelectedColor] = useState<string>(() =>
    parseColorParam(firstParam(params.color)),
  );

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Synchronous in-flight guard: `isSaving` state updates asynchronously, so
  // two rapid taps can both read `false` and fire duplicate inserts before the
  // re-render disables the button. The ref flips synchronously instead.
  const inFlightRef = useRef(false);
  // One idempotency key per form instance, reused across retries. It is sent
  // as the row id, so a double tap or a retry after a timeout resolves to the
  // same row instead of creating a duplicate.
  const idempotencyKeyRef = useRef<string | null>(null);
  if (idempotencyKeyRef.current === null) {
    idempotencyKeyRef.current = newHabitIdempotencyKey();
  }

  /** Shows a failure and stops the spinner, whatever the branch. */
  const handleError = useCallback((habitError: HabitError) => {
    setError(habitError.message);
    inFlightRef.current = false;
    setIsSaving(false);
  }, []);

  const handleCreate = useCallback(async () => {
    // Ref first: blocks a second tap in the same frame, before setState lands.
    if (inFlightRef.current) {
      return;
    }

    inFlightRef.current = true;
    setError(null);
    setIsSaving(true);

    const result = await createHabit({
      title: habitName,
      icon: selectedIcon,
      color: selectedColor,
      // `WeekdayPicker` works in `number[]`; narrow it to the domain type.
      targetDays: toWeekdayIndices(scheduleDays),
      // Photo proof with a live-camera shot is mandatory for every habit.
      photoMandatory: true,
      proofSource: 'camera',
      idempotencyKey: idempotencyKeyRef.current ?? undefined,
    });

    if (!result.ok) {
      handleError(result.error);
      return;
    }

    // Success: keep `inFlightRef` locked and the button disabled until the
    // screen unmounts, so a tap during the navigation transition cannot fire
    // a second insert. No `setIsSaving(false)` here.

    // Return to the previous screen, or to Today when this screen was opened
    // directly (deep link / web cold load) and there is nothing to pop.
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/today');
  }, [
    habitName,
    handleError,
    router,
    scheduleDays,
    selectedColor,
    selectedIcon,
  ]);

  return (
    <Screen scroll contentContainerStyle={styles.content}>
      <ScreenHeader
        showBack
        backFallbackHref="/today"
        eyebrow="Recurring"
        title="New habit"
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
      {/* Two summary rows instead of the full grid of tiles: the icon list and
          the colour list each live in their own sheet, so the form stays
          short. `color` is passed to the icon row so the preview shows both
          choices together. */}
      <IconPicker value={selectedIcon} color={selectedColor} onChange={setSelectedIcon} />
      <ColorPicker value={selectedColor} onChange={setSelectedColor} />

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

/**
 * Reads a single-valued route param. Expo Router hands back `string[]` when a
 * key repeats in the URL, so the first value wins.
 */
const firstParam = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

/** Parses the `days` param (`"0,2,4"`) into weekday indices. */
const parseDaysParam = (value: string | undefined): number[] => {
  if (!value) {
    return demoScheduleDays;
  }

  const days = value
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);

  return days.length > 0 ? [...new Set(days)] : demoScheduleDays;
};

/** Accepts a `#RRGGBB` colour param, falling back to the brand red. */
const parseColorParam = (value: string | undefined): string =>
  value && /^#[0-9a-f]{6}$/i.test(value.trim()) ? value.trim() : DEFAULT_HABIT_COLOR;

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
  submit: {
    marginTop: Spacing.two,
  },
});