import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { Button, Card, Screen, ScreenHeader, SegmentedControl } from '@/components/ui';
import { Fonts, Radii, Spacing } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/contexts/auth';
import { useThemePreference, type ThemePreference } from '@/contexts/theme';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useTheme } from '@/hooks/use-theme';
import { formatShortDate, getDeviceTimeZone } from '@/lib/dates';
import { getMyProfile } from '@/lib/profiles';

type ProfileFacts = {
  timezone: string;
  memberSince: string | null;
};

/**
 * Appearance choices in display order, with the labels the control shows.
 * `SegmentedControl` deals in the strings it renders, so the preference is
 * looked up back out of them on the way in.
 */
const THEME_CHOICES: { preference: ThemePreference; label: string }[] = [
  { preference: 'dark', label: 'Dark' },
  { preference: 'light', label: 'Light' },
  { preference: 'system', label: 'System' },
];

/**
 * Profile tab. The account card reflects the real signed-in user; the rows
 * below are the user's own facts — timezone and join date from their profile
 * row. RLS scopes every read to the open account.
 *
 * Habit/proof totals deliberately live on Analytics only; this screen stays
 * account settings.
 */
export default function ProfileScreen() {
  const theme = useTheme();
  const { signOut } = useAuth();
  const user = useCurrentUser();
  const { preference, setPreference } = useThemePreference();

  const [facts, setFacts] = useState<ProfileFacts | null>(null);

  const loadFacts = useCallback(async () => {
    const profile = await getMyProfile();

    if (!profile.ok && __DEV__) {
      console.warn('[Profile] getMyProfile failed:', profile.error);
    }

    const row = profile.ok ? profile.data : null;

    setFacts({
      timezone: row?.timezone?.trim() || getDeviceTimeZone(),
      memberSince: row?.created_at ? formatShortDate(row.created_at.slice(0, 10)) : null,
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadFacts();
    }, [loadFacts]),
  );

  // This screen sits behind the auth guard, so a missing user is only the
  // transient frame after sign-out before the router swaps the screen.
  if (!user) {
    return null;
  }

  const rows: { label: string; value: string }[] = [
    { label: 'Timezone', value: facts?.timezone ?? getDeviceTimeZone() },
    { label: 'Member since', value: facts?.memberSince ?? '—' },
  ];

  const selectedThemeLabel =
    THEME_CHOICES.find((choice) => choice.preference === preference)?.label ?? '';

  const handleThemeChange = (label: string) => {
    const choice = THEME_CHOICES.find((option) => option.label === label);

    if (choice) {
      setPreference(choice.preference);
    }
  };

  return (
    <Screen scroll tabBar>
      <ScreenHeader title="Profile" subtitle="Your account and preferences" />

      <Card style={styles.accountCard}>
        <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
          <Text style={styles.avatarText}>{user.initials}</Text>
        </View>
        <View style={styles.accountInfo}>
          <ThemedText type="smallBold">{user.fullName}</ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            {user.email}
          </ThemedText>
        </View>
      </Card>

      <Card style={styles.settingsCard}>
        {rows.map((row, index) => (
          <View
            key={row.label}
            style={[
              styles.settingRow,
              index > 0 && [styles.settingDivider, { borderTopColor: theme.border }],
            ]}>
            <ThemedText type="small">{row.label}</ThemedText>
            <ThemedText type="caption" themeColor="textSecondary">
              {row.value}
            </ThemedText>
          </View>
        ))}
      </Card>

      <Card style={styles.appearanceCard}>
        <View style={styles.appearanceCopy}>
          <ThemedText type="section">Appearance</ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            System follows your device&apos;s light or dark setting.
          </ThemedText>
        </View>
        <SegmentedControl
          options={THEME_CHOICES.map((choice) => choice.label)}
          value={selectedThemeLabel}
          onChange={handleThemeChange}
        />
      </Card>

      <Button
        label="Sign Out"
        size="md"
        variant="outline"
        // Clearing the session flips the root guard, which returns to welcome.
        onPress={() => {
          void signOut();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: Fonts.serif,
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  accountInfo: {
    flex: 1,
    gap: 2,
  },
  settingsCard: {
    padding: 0,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 6,
    gap: Spacing.two,
  },
  settingDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  appearanceCard: {
    gap: Spacing.three,
  },
  appearanceCopy: {
    gap: Spacing.one,
  },
});
