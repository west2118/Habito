import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Button, Screen } from '@/components/ui';
import { ThemedText } from '@/components/themed-text';
import {
  PRESET_CATEGORIES,
  presetHabitParams,
  type PresetHabit,
} from '@/constants/preset-habits';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { claimNavigation } from '@/lib/nav-guard';

type PresetWithCategory = PresetHabit & { categoryTitle: string };

/**
 * "Pick a New One" gallery — opened from the tab-bar "+" button.
 *
 * Tapping a category opens its habit list; tapping a habit (here or in
 * search results) opens the New habit form with the name, icon and colour
 * already filled in, so the user only picks the schedule days. "Create Your
 * Own" opens the blank form.
 */
export default function PickHabitScreen() {
  const router = useRouter();
  const theme = useTheme();

  const [query, setQuery] = useState('');
  // Drops the second push of a rapid double tap, so two identical forms or
  // category pages never stack (see `@/lib/nav-guard`).
  const lastNavRef = useRef(0);

  const close = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/today');
  }, [router]);

  const goToCreateOwn = useCallback(() => {
    if (!claimNavigation(lastNavRef)) {
      return;
    }

    router.push('/habit/new');
  }, [router]);

  const openCategory = useCallback(
    (id: string) => {
      if (!claimNavigation(lastNavRef)) {
        return;
      }

      router.push({ pathname: '/habit/pick/[category]', params: { category: id } });
    },
    [router],
  );

  const openPreset = useCallback(
    (preset: PresetHabit) => {
      if (!claimNavigation(lastNavRef)) {
        return;
      }

      router.push({ pathname: '/habit/new', params: presetHabitParams(preset) });
    },
    [router],
  );

  const filtered: PresetWithCategory[] = useMemo(() => {
    const needle = query.trim().toLowerCase();

    if (needle.length === 0) {
      return [];
    }

    return PRESET_CATEGORIES.flatMap((category) =>
      category.presets
        .filter((preset) => preset.title.toLowerCase().includes(needle))
        .map((preset) => ({ ...preset, categoryTitle: category.title })),
    );
  }, [query]);

  const isSearching = query.trim().length > 0;

  return (
    <Screen style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={close}
          hitSlop={8}
          style={styles.closeButton}>
          <Ionicons name="close" size={26} color={theme.text} />
        </Pressable>
        <ThemedText type="section" style={styles.headerTitle} numberOfLines={1}>
          Pick a New One
        </ThemedText>
        <View style={styles.closeButton} />
      </View>

      <View style={[styles.search, { backgroundColor: theme.backgroundElevated }]}>
        <Ionicons name="search" size={20} color={theme.textMuted} />
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="Search"
          placeholderTextColor={theme.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            onPress={() => setQuery('')}
            hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={theme.textMuted} />
          </Pressable>
        )}
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        {isSearching ? (
          filtered.length === 0 ? (
            <ThemedText type="caption" themeColor="textSecondary" style={styles.centerText}>
              No habits match “{query.trim()}”. Try another search or create your own.
            </ThemedText>
          ) : (
            filtered.map((preset) => (
              <Pressable
                key={preset.title}
                accessibilityRole="button"
                accessibilityLabel={`Use ${preset.title}`}
                onPress={() => openPreset(preset)}
                style={({ pressed }) => [
                  styles.presetRow,
                  { backgroundColor: theme.backgroundElevated, opacity: pressed ? 0.9 : 1 },
                ]}>
                <View style={[styles.presetIcon, { backgroundColor: `${preset.color}26` }]}>
                  <Ionicons name={preset.icon} size={20} color={preset.color} />
                </View>
                <View style={styles.presetText}>
                  <ThemedText type="default">{preset.title}</ThemedText>
                  <ThemedText type="caption" themeColor="textMuted">
                    {preset.categoryTitle}
                  </ThemedText>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
              </Pressable>
            ))
          )
        ) : (
          PRESET_CATEGORIES.map((category) => (
            <Pressable
              key={category.id}
              accessibilityRole="button"
              accessibilityLabel={`${category.title}. ${category.subtitle}`}
              onPress={() => openCategory(category.id)}
              style={({ pressed }) => [
                styles.card,
                {
                  backgroundColor: `${category.tint}14`,
                  borderColor: `${category.tint}38`,
                  opacity: pressed ? 0.88 : 1,
                },
              ]}>
              <View style={styles.cardText}>
                <ThemedText type="section">{category.title}</ThemedText>
                <ThemedText type="caption" themeColor="textSecondary">
                  {category.subtitle}
                </ThemedText>
                <View style={[styles.countPill, { backgroundColor: `${category.tint}26` }]}>
                  <ThemedText type="captionBold" style={{ color: category.tint }}>
                    {category.presets.length} habits
                  </ThemedText>
                </View>
              </View>
              <View style={[styles.artwork, { backgroundColor: `${category.tint}26` }]}>
                <Ionicons name={category.icon} size={48} color={category.tint} />
              </View>
              <View style={[styles.chevronRing, { borderColor: `${category.tint}55` }]}>
                <Ionicons name="chevron-forward" size={16} color={category.tint} />
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>

      <Button label="Create Your Own" size="lg" onPress={goToCreateOwn} style={styles.cta} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingTop: Spacing.four,
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  closeButton: {
    width: 40,
    alignItems: 'flex-start',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 22,
    lineHeight: 28,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radii.lg,
    paddingHorizontal: Spacing.three,
    height: 52,
    gap: Spacing.two,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  list: {
    flex: 1,
  },
  listContent: {
    gap: Spacing.three,
    paddingBottom: Spacing.two,
  },
  centerText: {
    textAlign: 'center',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radii.lg + 4,
    borderWidth: 1,
    padding: Spacing.three + 2,
    gap: Spacing.two,
    minHeight: 124,
  },
  cardText: {
    flex: 1,
    gap: Spacing.one,
  },
  countPill: {
    alignSelf: 'flex-start',
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    marginTop: Spacing.one,
  },
  artwork: {
    width: 92,
    height: 92,
    borderRadius: Radii.md + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevronRing: {
    width: 28,
    height: 28,
    borderRadius: Radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.one,
  },
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radii.md,
    padding: Spacing.two + 2,
    gap: Spacing.two,
  },
  presetIcon: {
    width: 40,
    height: 40,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetText: {
    flex: 1,
    gap: 2,
  },
  cta: {
    borderRadius: Radii.pill,
  },
});
