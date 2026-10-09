import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Card, Screen, ScreenHeader } from '@/components/ui';
import { Fonts, Radii, Spacing } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { demoProfileSettings } from '@/constants/demo-data';
import { useAuth } from '@/contexts/auth';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useTheme } from '@/hooks/use-theme';

/**
 * Profile tab. The account card reflects the real signed-in user; the
 * preference rows are still placeholder copy pending a settings feature.
 */
export default function ProfileScreen() {
  const theme = useTheme();
  const { signOut } = useAuth();
  const user = useCurrentUser();

  // This screen sits behind the auth guard, so a missing user is only the
  // transient frame after sign-out before the router swaps the screen.
  if (!user) {
    return null;
  }

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
        {demoProfileSettings.map((row, index) => (
          <View
            key={row.label}
            style={[
              styles.settingRow,
              index > 0 && [styles.settingDivider, { borderTopColor: theme.border }],
            ]}>
            <ThemedText type="small">{row.label}</ThemedText>
            <View style={styles.settingValue}>
              <ThemedText type="caption" themeColor="textSecondary">
                {row.value}
              </ThemedText>
              <Ionicons name="chevron-forward" size={14} color={theme.textMuted} />
            </View>
          </View>
        ))}
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
  settingValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
});
