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
import { resendConfirmationEmail } from '@/lib/auth';

/**
 * Sign in with email and password.
 *
 * The form calls the `signIn` action from the auth context and renders whatever
 * failure it returns — the API already maps Supabase's errors to friendly copy,
 * including the deliberately vague "invalid credentials" message that avoids
 * revealing whether an account exists. On success there is nothing to navigate:
 * the session flips and the root route guard swaps this screen for the app.
 *
 * An unconfirmed account cannot sign in. Instead of a dead end, that case
 * resends a fresh 6-digit code and swaps the form for the same verification
 * panel sign-up uses — e.g. for users who closed the app before verifying.
 */
export default function SignInScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { signIn, verifySignUpCode } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Unconfirmed account awaiting its code — null while on the password form.
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [codeSentAt, setCodeSentAt] = useState<number | null>(null);

  const handleSubmit = useCallback(async () => {
    if (isSubmitting) {
      return;
    }

    setError(null);
    setNotice(null);
    setIsSubmitting(true);

    const result = await signIn({ email, password });

    // A signed-in user is redirected away by the root guard, so only the
    // failure branch needs to stop the spinner.
    if (!result.ok) {
      if (result.error.code === 'email_not_confirmed') {
        // The account exists but was never verified: send a fresh code and
        // move to verification instead of leaving the user stuck.
        const resent = await resendConfirmationEmail(email);

        setIsSubmitting(false);

        if (!resent.ok) {
          setError(resent.error.message);
          return;
        }

        setPendingEmail(email);
        setCodeSentAt(Date.now());
        setNotice('That account was never verified — we sent a fresh code.');
        return;
      }

      setError(result.error.message);
      setIsSubmitting(false);
    }
  }, [email, isSubmitting, password, signIn]);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/');
  }, [router]);

  const handleBackToForm = useCallback(() => {
    setPendingEmail(null);
    setCodeSentAt(null);
    setError(null);
    setNotice(null);
  }, []);

  if (pendingEmail !== null && codeSentAt !== null) {
    return (
      <Screen scroll contentContainerStyle={styles.content}>
        <BackButton onPress={handleBack} style={styles.back} />

        <View style={styles.body}>
          <AuthHero
            eyebrow="Almost there"
            title="Verify your email"
            subtitle={`We sent a 6-digit code to ${pendingEmail.trim()}. Enter it within 15 minutes to activate your account.`}
          />

          {notice !== null && (
            <ThemedText type="caption" themeColor="primary" style={styles.centerText}>
              {notice}
            </ThemedText>
          )}

          <VerifyCodePanel
            email={pendingEmail}
            sentAt={codeSentAt}
            // Legacy path for accounts created before gated sign-up: their
            // unconfirmed row already exists, so the Supabase OTP confirms it.
            verify={(code) => verifySignUpCode(pendingEmail, code)}
            resend={() => resendConfirmationEmail(pendingEmail)}
            onCodeResent={setCodeSentAt}
            // Verifying applies the session in the auth context, so the root
            // guard moves the account into the app on the next render.
            onVerified={() => {}}
            testIDPrefix="sign-in-verify"
          />

          <Button
            label="Use a different account"
            size="md"
            variant="text"
            onPress={handleBackToForm}
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
          eyebrow="Welcome back"
          title="Sign in"
          subtitle="Pick up your streak right where you left off."
        />

        <View style={styles.form}>
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
            testID="sign-in-email"
          />
          <FormField
            label="Password"
            icon="lock-closed"
            placeholder="Your password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={handleSubmit}
            editable={!isSubmitting}
            testID="sign-in-password"
          />
        </View>

        {error !== null && (
          <ThemedText
            type="caption"
            style={[styles.error, { color: theme.primary }]}
            testID="sign-in-error">
            {error}
          </ThemedText>
        )}

        <Button
          label={isSubmitting ? 'Signing in…' : 'Sign In'}
          size="lg"
          onPress={handleSubmit}
          disabled={isSubmitting}
          testID="sign-in-submit"
        />

        <View style={styles.footer}>
          <ThemedText type="caption" themeColor="textSecondary">
            New to Habito?
          </ThemedText>
          <Pressable
            accessibilityRole="link"
            disabled={isSubmitting}
            onPress={() => router.push('/sign-up')}
            hitSlop={8}>
            <ThemedText type="captionBold" themeColor="primary">
              Create an account
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
  error: {
    textAlign: 'center',
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
