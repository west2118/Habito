import { Platform, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type AuthHeroProps = {
  /** Small uppercase label above the title (e.g. "WELCOME BACK"). */
  eyebrow: string;
  title: string;
  subtitle: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Branded header shared by the Sign in and Create account screens: the glowing
 * Habito mark plus a title block. Kept in one place so the two auth screens
 * cannot drift apart visually.
 */
export function AuthHero({ eyebrow, title, subtitle, style }: AuthHeroProps) {
  const theme = useTheme();

  return (
    <View style={[styles.container, style]}>
      <View style={[styles.logo, { backgroundColor: theme.primary }]}>
        <Text style={styles.logoLetter}>H</Text>
      </View>
      <ThemedText type="eyebrow" themeColor="textSecondary" style={styles.eyebrow}>
        {eyebrow}
      </ThemedText>
      <ThemedText type="screenTitle">{title}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
        {subtitle}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: Spacing.one,
    marginBottom: Spacing.three,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
    // `shadow*` is deprecated on react-native-web; use `boxShadow` there.
    ...Platform.select({
      web: {
        boxShadow: '0px 0px 24px rgba(225, 18, 31, 0.6)',
      },
      default: {
        shadowColor: '#E1121F',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 24,
        elevation: 12,
      },
    }),
  },
  logoLetter: {
    fontFamily: Fonts.serif,
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  eyebrow: {
    letterSpacing: 3,
  },
  subtitle: {
    textAlign: 'center',
    marginTop: Spacing.one,
    paddingHorizontal: Spacing.three,
  },
});
