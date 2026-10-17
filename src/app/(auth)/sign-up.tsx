import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AuthHero } from '@/components/auth-hero';
import { ThemedText } from '@/components/themed-text';
import { BackButton, Button, FormField, Screen } from '@/components/ui';
import { VerifyCodePanel } from '@/components/verify-code-panel';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth';
import { useTheme } from '@/hooks/use-theme';
import { requestSignupCode } from '@/lib/auth';

/**
 * Create an account with email and password.
 *
 * Gated sign-up: submitting only emails a 6-digit code (15-minute lifetime)
 * and the account is created inside the verification call. A wrong/expired
 * code — or a user who walks away — leaves no account behind, and that email
 * can never sign in because it was never registered. The password stays in
 * screen state between the two steps and is never stored anywhere.
 */
export default function SignUpScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { completeGatedSignup } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  // When the current code was sent — starts the panel's 15-minute countdown.
  const [codeSentAt, setCodeSentAt] = useState<number | null>(null);

  const handleSubmit = useCallback(async () => {
    if (isSubmitting) {
      return;
    }

    // Checked here rather than in the API: confirm-password is a UI concern,
    // the server only ever sees the single password.
    if (password !== confirmPassword) {
      setError('Those passwords do not match.');
      return;
    }

    setError(null);
    setNotice(null);
    setIsSubmitting(true);

    // Step 1 sends the code only — no account exists after this call.
    const result = await requestSignupCode({ email, fullName });

    setIsSubmitting(false);

    if (!result.ok) {
      setError(result.error.message);
      return;
    }

    setAwaitingConfirmation(true);
    setCodeSentAt(Date.now());
  }, [confirmPassword, email, fullName, isSubmitting, password]);

  const handleBack = useCallback(() => {
    if (awaitingConfirmation) {
      setAwaitingConfirmation(false);
      return;
    }

    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/');
  }, [awaitingConfirmation, router]);

  if (awaitingConfirmation) {
    return (
      <Screen scroll contentContainerStyle={styles.content}>
        <BackButton onPress={handleBack} style={styles.back} />

        <View style={styles.body}>
          <AuthHero
            eyebrow="Almost there"
            title="Check your inbox"
            subtitle={`We sent a 6-digit code to ${email.trim()}. Enter it within 15 minutes to activate your account.`}
          />

          {notice !== null && (
            <ThemedText
              type="caption"
              themeColor="primary"
              style={styles.centerText}
              testID="sign-up-notice">
              {notice}
            </ThemedText>
          )}

          {codeSentAt !== null && (
            <VerifyCodePanel
              email={email}
              sentAt={codeSentAt}
              // Step 2 creates the account inside the verification call: only
              // a correct, in-window code produces an account, and verifying
              // signs it straight in via the auth context.
              verify={(code) => completeGatedSignup(email, code, password, fullName)}
              resend={() => requestSignupCode({ email, fullName })}
              onCodeResent={setCodeSentAt}
              onChangeEmail={() => setAwaitingConfirmation(false)}
              // Verifying applies the session in the auth context, so the
              // root guard moves the new account into the app on next render.
              onVerified={() => {}}
              testIDPrefix="sign-up-verify"
            />
          )}

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
          label={isSubmitting ? 'Sending code…' : 'Send verification code'}
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
