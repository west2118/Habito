import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, Screen, ScreenHeader } from '@/components/ui';
import { ThemedText } from '@/components/themed-text';
import { PRESET_CATEGORIES, presetHabitParams, type PresetHabit } from '@/constants/preset-habits';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { claimNavigation } from '@/lib/nav-guard';

/** Monday-first short day names, matching `WeekdayPicker` (`0 = Monday`). */
const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

/** Human schedule label for a preset, e.g. "Daily" or "Mon · Wed · Fri". */
const scheduleLabel = (targetDays: readonly number[]): string => {
  if (targetDays.length >= 7) {
    return 'Daily';
  }

  return [...targetDays]
    .sort((a, b) => a - b)
    .map((day) => WEEKDAY_SHORT[day] ?? '')
    .filter((label) => label.length > 0)
    .join(' · ');
};

/**
 * One gallery category — the habit list behind a "Pick a New One" card.
 *
 * Tapping a habit opens the New habit form with its name, icon and colour
 * already filled in; the user only picks the schedule days before creating.
 */
export default function PickCategoryScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { category } = useLocalSearchParams<{ category: string }>();
  const categoryId = Array.isArray(category) ? category[0] : category;

  const matched = PRESET_CATEGORIES.find((entry) => entry.id === categoryId) ?? null;

  // Drops the second push of a rapid double tap, so two identical prefilled
  // forms never stack (see `@/lib/nav-guard`).
  const lastNavRef = useRef(0);

  const goBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/habit/pick');
  }, [router]);

  const openPreset = useCallback(
    (preset: PresetHabit) => {
      if (!claimNavigation(lastNavRef)) {
        return;
      }

      router.push({ pathname: '/habit/new', params: presetHabitParams(preset) });
    },
    [router],
  );

  if (matched === null) {
    return (
      <Screen contentContainerStyle={styles.content}>
        <ScreenHeader showBack backFallbackHref="/habit/pick" title="Pick a New One" />
        <ThemedText type="caption" themeColor="textSecondary" style={styles.centerText}>
          That collection could not be found.
        </ThemedText>
        <Button label="Back to collections" onPress={goBack} />
      </Screen>
    );
  }

  return (
    <Screen scroll contentContainerStyle={styles.content}>
      <ScreenHeader
        showBack
        backFallbackHref="/habit/pick"
        eyebrow={`${matched.presets.length} habits`}
        title={matched.title}
        subtitle={matched.subtitle}
      />

      {matched.presets.map((preset) => (
        <Pressable
          key={preset.title}
          accessibilityRole="button"
          accessibilityLabel={`Use ${preset.title}`}
          onPress={() => openPreset(preset)}
          style={({ pressed }) => [
            styles.row,
            {
              backgroundColor: theme.backgroundElevated,
              borderColor: `${preset.color}38`,
              opacity: pressed ? 0.88 : 1,
            },
          ]}>
          <View style={[styles.icon, { backgroundColor: `${preset.color}26` }]}>
            <Ionicons name={preset.icon} size={24} color={preset.color} />
          </View>
          <View style={styles.rowText}>
            <ThemedText type="default">{preset.title}</ThemedText>
            <ThemedText type="caption" themeColor="textMuted">
              {scheduleLabel(preset.targetDays)} · Photo proof
            </ThemedText>
          </View>
          <View style={[styles.chevronRing, { borderColor: `${preset.color}55` }]}>
            <Ionicons name="chevron-forward" size={16} color={preset.color} />
          </View>
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: Spacing.four,
    gap: Spacing.two + 2,
  },
  centerText: {
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radii.md + 2,
    borderWidth: 1,
    padding: Spacing.three,
    gap: Spacing.two + 2,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  chevronRing: {
    width: 28,
    height: 28,
    borderRadius: Radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
