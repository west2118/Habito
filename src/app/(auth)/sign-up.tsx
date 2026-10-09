import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AuthHero } from '@/components/auth-hero';
import { ThemedText } from '@/components/themed-text';
import { BackButton, Button, Card, FormField, Screen } from '@/components/ui';
import { Radii, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth';
import { useTheme } from '@/hooks/use-theme';
import { resendConfirmationEmail } from '@/lib/auth';

/**
 * Create an account with email and password.
 *
 * Two outcomes are possible after a successful request:
 * - The project auto-confirms emails, so a session is returned and the root
 *   route guard moves the user straight into the app.
 * - The project requires confirmation, so `needsEmailConfirmation` is true and
 *   we swap the form for a "check your inbox" panel with a resend action.
 */
export default function SignUpScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { signUp } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (isSubmitting) {
      return;
    }

    // Checked here rather than in the API: confirm-password is a UI concern,
    // Supabase only ever sees the single password.
    if (password !== confirmPassword) {
      setError('Those passwords do not match.');
      return;
    }

    setError(null);
    setNotice(null);
    setIsSubmitting(true);

    const result = await signUp({ email, password, fullName });

    if (!result.ok) {
      setError(result.error.message);
      setIsSubmitting(false);
      return;
    }

    if (result.data.needsEmailConfirmation) {
      setAwaitingConfirmation(true);
      setIsSubmitting(false);
      return;
    }

    // Auto-confirmed: the root guard redirects into the app on the next render.
  }, [confirmPassword, email, fullName, isSubmitting, password, signUp]);

  const handleResend = useCallback(async () => {
    if (isSubmitting) {
      return;
    }

    setError(null);
    setNotice(null);
    setIsSubmitting(true);

    const result = await resendConfirmationEmail(email);

    if (result.ok) {
      setNotice('Confirmation email sent again.');
    } else {
      setError(result.error.message);
    }

    setIsSubmitting(false);
  }, [email, isSubmitting]);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/');
  }, [router]);

  if (awaitingConfirmation) {
    return (
      <Screen scroll contentContainerStyle={styles.content}>
        <BackButton onPress={handleBack} style={styles.back} />

        <View style={styles.body}>
          <AuthHero
            eyebrow="Almost there"
            title="Check your inbox"
            subtitle={`We sent a confirmation link to ${email.trim()}. Tap it to activate your account.`}
          />

          <Card style={styles.confirmCard}>
            <View style={[styles.confirmIcon, { backgroundColor: theme.primarySoft }]}>
              <Ionicons name="mail-unread" size={26} color={theme.primary} />
            </View>
            <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
              Confirming your email keeps your photo proofs and streaks tied to an account only you
              can access.
            </ThemedText>
          </Card>

          {notice !== null && (
            <ThemedText
              type="caption"
              themeColor="primary"
              style={styles.centerText}
              testID="sign-up-notice">
              {notice}
            </ThemedText>
          )}

          {error !== null && (
            <ThemedText
              type="caption"
              style={[styles.centerText, { color: theme.primary }]}
              testID="sign-up-error">
              {error}
            </ThemedText>
          )}

          <Button
            label={isSubmitting ? 'Sending…' : 'Resend email'}
            size="lg"
            variant="outline"
            onPress={handleResend}
            disabled={isSubmitting}
            testID="sign-up-resend"
          />
          <Button
            label="Back to sign in"
            size="md"
            variant="text"
            onPress={() => router.replace('/sign-in')}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll contentContainerStyle={styles.content}>
      <BackButton onPress={handleBack} style={styles.back} />

      {/* Grows to fill the viewport so the form sits in the vertical centre. */}
      <View style={styles.body}>
        <AuthHero
          eyebrow="Get started"
          title="Create account"
          subtitle="Snap the proof, build the streak, keep the memories."
        />

        <View style={styles.form}>
          <FormField
            label="Full name (optional)"
            icon="person"
            placeholder="e.g. John Tapang"
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
            editable={!isSubmitting}
            testID="sign-up-name"
          />
          <FormField
            label="Email"
            icon="mail"
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            editable={!isSubmitting}
            testID="sign-up-email"
          />
          <FormField
            label="Password"
            icon="lock-closed"
            placeholder="At least 8 characters"
            helperText="Use a mix of letters, numbers and symbols."
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            editable={!isSubmitting}
            testID="sign-up-password"
          />
          <FormField
            label="Confirm password"
            icon="lock-closed"
            placeholder="Repeat your password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={handleSubmit}
            editable={!isSubmitting}
            testID="sign-up-confirm-password"
          />
        </View>

        {error !== null && (
          <ThemedText
            type="caption"
            style={[styles.centerText, { color: theme.primary }]}
            testID="sign-up-error">
            {error}
          </ThemedText>
        )}

        <Button
          label={isSubmitting ? 'Creating account…' : 'Create Account'}
          size="lg"
          onPress={handleSubmit}
          disabled={isSubmitting}
          testID="sign-up-submit"
        />

        <View style={styles.footer}>
          <ThemedText type="caption" themeColor="textSecondary">
            Already have an account?
          </ThemedText>
          <Pressable
            accessibilityRole="link"
            disabled={isSubmitting}
            onPress={() => router.replace('/sign-in')}
            hitSlop={8}>
            <ThemedText type="captionBold" themeColor="primary">
              Sign in
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    // `flexGrow` (not `flex`) so an overflowing form still scrolls from the top
    // instead of being clipped when the keyboard is open.
    flexGrow: 1,
    paddingTop: Spacing.two,
  },
  back: {
    alignSelf: 'flex-start',
  },
  body: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: Spacing.three + 2,
  },
  form: {
    gap: Spacing.three,
  },
  confirmCard: {
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.four,
  },
  confirmIcon: {
    width: 56,
    height: 56,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerText: {
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one + 2,
  },
});
