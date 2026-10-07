import { useRouter } from 'expo-router';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { Button, Screen } from '@/components/ui';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Spacing } from '@/constants/theme';

/**
 * Welcome screen: Habito wordmark, tagline and the Get Started / Sign In
 * entry points. Navigation only — real auth is added with the logic phase.
 */
export default function WelcomeScreen() {
  const router = useRouter();

  const enterApp = () => router.replace('/today');

  return (
    <Screen contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={styles.logo}>
          <Text style={styles.logoLetter}>H</Text>
        </View>
        <ThemedText type="eyebrow" themeColor="textSecondary" style={styles.eyebrow}>
          Welcome to
        </ThemedText>
        <ThemedText type="hero">Habito</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.tagline}>
          See your habits grow.{'\n'}Snap the proof, build the streak.
        </ThemedText>
      </View>

      <View style={styles.actions}>
        <Button label="Get Started" size="lg" onPress={enterApp} />
        <Button label="Sign In" size="lg" variant="outline" onPress={enterApp} />
      </View>

      <ThemedText type="caption" themeColor="textMuted" style={styles.legal}>
        By continuing, you agree to our{'\n'}
        <Text style={styles.legalLink}>Terms of Service</Text> and{' '}
        <Text style={styles.legalLink}>Privacy Policy</Text>
      </ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  logo: {
    width: 76,
    height: 76,
    borderRadius: 22,
    backgroundColor: '#E1121F',
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
    fontSize: 38,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  eyebrow: {
    letterSpacing: 3,
  },
  tagline: {
    textAlign: 'center',
    marginTop: Spacing.one,
  },
  actions: {
    gap: Spacing.two + 4,
  },
  legal: {
    textAlign: 'center',
    lineHeight: 18,
  },
  legalLink: {
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
