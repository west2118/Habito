import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  NativeSyntheticEvent,
  StyleSheet,
  TextInput,
  TextInputKeyPressEventData,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card } from '@/components/ui';
import { Radii, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth';
import { useTheme } from '@/hooks/use-theme';
import {
  createAuthError,
  formatVerificationCountdown,
  isVerificationCodeExpired,
  resendConfirmationEmail,
  sanitizeVerificationCodeInput,
  VERIFICATION_CODE_EXPIRY_MINUTES,
  VERIFICATION_CODE_LENGTH,
  VERIFICATION_RESEND_COOLDOWN_SECONDS,
  verificationCodeRemainingMs,
  type AuthResult,
} from '@/lib/auth';
import type { Session } from '@supabase/supabase-js';

export type VerifyCodePanelProps = {
  /** Address the code was sent to. */
  email: string;
  /** When the current code was sent (epoch ms) — drives the countdown. */
  sentAt: number;
  /**
   * Verifies one code entry and resolves the session on success. Gated
   * sign-up creates the account inside this call, so only a good code ever
   * produces an account; legacy OTP confirmation resolves the same shape.
   */
  verify?: (code: string) => Promise<AuthResult<Session>>;
  /** Sends a fresh code and restarts the 15-minute window. */
  resend?: () => Promise<AuthResult<null>>;
  /** Called with `Date.now()` after a successful resend, to restart the timer. */
  onCodeResent: (sentAt: number) => void;
  /** Called after the code verifies — the session is already applied. */
  onVerified: () => void;
  /** Optional callback to let user change email address. */
  onChangeEmail?: () => void;
  testIDPrefix?: string;
};

/**
 * 6-digit email verification with a 15-minute countdown.
 *
 * Expiry is enforced twice: the countdown blocks submitting a dead code (the
 * server is the real expiry — its OTP window must be 900s), and resending
 * restarts the window with a fresh code.
 */
export function VerifyCodePanel({
  email,
  sentAt,
  verify,
  resend,
  onCodeResent,
  onVerified,
  onChangeEmail,
  testIDPrefix = 'verify-code',
}: VerifyCodePanelProps) {
  const theme = useTheme();
  const { verifySignUpCode } = useAuth();

  const verifyAction = useMemo(
    () => verify ?? ((code: string) => verifySignUpCode(email, code)),
    [email, verify, verifySignUpCode],
  );
  const resendAction = useMemo(
    () => resend ?? (() => resendConfirmationEmail(email)),
    [email, resend],
  );

  const [digits, setDigits] = useState<string[]>(() =>
    Array(VERIFICATION_CODE_LENGTH).fill(''),
  );
  const [focusedIndex, setFocusedIndex] = useState<number | null>(0);
  const [now, setNow] = useState(() => Date.now());
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const inputRefs = useRef<(TextInput | null)[]>([]);
  const verifyingForRef = useRef<string | null>(null);

  const fullCode = digits.join('');

  // Ticks the countdown (and the resend cooldown) once a second.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);

    return () => clearInterval(timer);
  }, []);

  const remainingMs = verificationCodeRemainingMs(sentAt, now);
  const isExpired = isVerificationCodeExpired(sentAt, now);
  const resendCooldownLeft =
    VERIFICATION_RESEND_COOLDOWN_SECONDS - Math.floor((now - sentAt) / 1000);
  const canResend = resendCooldownLeft <= 0 && !isResending;

  const handleVerify = useCallback(
    async (codeToVerify: string) => {
      if (isVerifying) {
        return;
      }

      if (isVerificationCodeExpired(sentAt, Date.now())) {
        setError(createAuthError('otp_expired').message);
        return;
      }

      setError(null);
      setNotice(null);
      setIsVerifying(true);
      verifyingForRef.current = codeToVerify;

      const result = await verifyAction(codeToVerify);

      verifyingForRef.current = null;
      setIsVerifying(false);

      if (!result.ok) {
        setError(result.error.message);
        return;
      }

      onVerified();
    },
    [isVerifying, onVerified, sentAt, verifyAction],
  );

  // Auto-submits the moment all six digits are filled.
  useEffect(() => {
    if (
      fullCode.length === VERIFICATION_CODE_LENGTH &&
      verifyingForRef.current !== fullCode &&
      !isVerifying &&
      !isExpired
    ) {
      void handleVerify(fullCode);
    }
  }, [fullCode, handleVerify, isExpired, isVerifying]);

  const handleDigitChange = useCallback(
    (text: string, index: number) => {
      setError(null);
      const sanitized = sanitizeVerificationCodeInput(text);

      // Pasted full or multi-digit code
      if (sanitized.length > 1) {
        const nextDigits = [...digits];
        const chars = sanitized.split('');
        for (let i = 0; i < VERIFICATION_CODE_LENGTH; i++) {
          nextDigits[i] = chars[i] ?? '';
        }
        setDigits(nextDigits);
        const nextFocus = Math.min(sanitized.length, VERIFICATION_CODE_LENGTH - 1);
        inputRefs.current[nextFocus]?.focus();
        return;
      }

      const nextDigits = [...digits];
      nextDigits[index] = sanitized;
      setDigits(nextDigits);

      if (sanitized && index < VERIFICATION_CODE_LENGTH - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    },
    [digits],
  );

  const handleKeyPress = useCallback(
    (e: NativeSyntheticEvent<TextInputKeyPressEventData>, index: number) => {
      if (e.nativeEvent.key === 'Backspace') {
        if (!digits[index] && index > 0) {
          const nextDigits = [...digits];
          nextDigits[index - 1] = '';
          setDigits(nextDigits);
          inputRefs.current[index - 1]?.focus();
        }
      }
    },
    [digits],
  );

  const handleResend = useCallback(async () => {
    if (!canResend) {
      return;
    }

    setError(null);
    setNotice(null);
    setIsResending(true);

    const result = await resendAction();

    setIsResending(false);

    if (!result.ok) {
      setError(result.error.message);
      return;
    }

    setDigits(Array(VERIFICATION_CODE_LENGTH).fill(''));
    setNotice('A new 6-digit code has been sent — expires in 15 minutes.');
    onCodeResent(Date.now());
    inputRefs.current[0]?.focus();
  }, [canResend, onCodeResent, resendAction]);

  return (
    <View style={styles.container}>
      <Card style={styles.codeCard}>
        {/* 15-Minute Countdown Badge */}
        <View
          style={[
            styles.timerBadge,
            {
              backgroundColor: isExpired ? theme.primarySoft : theme.backgroundElevated,
            },
          ]}>
          <Ionicons
            name={isExpired ? 'alert-circle' : 'time-outline'}
            size={18}
            color={isExpired ? theme.primary : theme.textSecondary}
          />
          <ThemedText
            type="captionBold"
            style={{ color: isExpired ? theme.primary : theme.textSecondary }}>
            {isExpired
              ? 'Code expired (15m limit reached)'
              : `Code expires in ${formatVerificationCountdown(remainingMs)}`}
          </ThemedText>
        </View>

        <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
          Enter the 6-digit code sent to{' '}
          <ThemedText type="smallBold" themeColor="text">
            {email.trim()}
          </ThemedText>{' '}
          within {VERIFICATION_CODE_EXPIRY_MINUTES} minutes to create and activate your account.
        </ThemedText>

        {/* 6-Digit OTP Boxes */}
        <View style={styles.otpRow} testID={`${testIDPrefix}-input`}>
          {Array.from({ length: VERIFICATION_CODE_LENGTH }).map((_, index) => {
            const isFocused = focusedIndex === index;
            const hasValue = Boolean(digits[index]);

            return (
              <TextInput
                key={index}
                ref={(ref) => {
                  inputRefs.current[index] = ref;
                }}
                style={[
                  styles.otpBox,
                  {
                    backgroundColor: theme.backgroundElement,
                    color: theme.text,
                    borderColor: isFocused
                      ? theme.primary
                      : hasValue
                        ? theme.border
                        : theme.border,
                  },
                ]}
                value={digits[index]}
                onChangeText={(text) => handleDigitChange(text, index)}
                onKeyPress={(e) => handleKeyPress(e, index)}
                onFocus={() => setFocusedIndex(index)}
                onBlur={() => {
                  if (focusedIndex === index) {
                    setFocusedIndex(null);
                  }
                }}
                keyboardType="number-pad"
                maxLength={VERIFICATION_CODE_LENGTH}
                selectTextOnFocus
                editable={!isVerifying}
                testID={`${testIDPrefix}-box-${index}`}
                accessibilityLabel={`Digit ${index + 1}`}
              />
            );
          })}
        </View>

        {notice !== null && (
          <ThemedText
            type="caption"
            themeColor="primary"
            style={styles.centerText}
            testID={`${testIDPrefix}-notice`}>
            {notice}
          </ThemedText>
        )}

        {error !== null && (
          <ThemedText
            type="caption"
            style={[styles.centerText, { color: theme.primary }]}
            testID={`${testIDPrefix}-error`}>
            {error}
          </ThemedText>
        )}

        <Button
          label={
            isVerifying
              ? 'Verifying…'
              : isExpired
                ? 'Code expired — Resend below'
                : 'Verify & Create Account'
          }
          size="lg"
          onPress={() => {
            void handleVerify(fullCode);
          }}
          disabled={
            isVerifying ||
            fullCode.length !== VERIFICATION_CODE_LENGTH ||
            isExpired
          }
          testID={`${testIDPrefix}-submit`}
        />
      </Card>

      <Button
        label={
          isResending
            ? 'Sending…'
            : canResend
              ? 'Resend 6-digit code'
              : `Resend code in ${resendCooldownLeft}s`
        }
        size="md"
        variant="outline"
        onPress={handleResend}
        disabled={!canResend}
        testID={`${testIDPrefix}-resend`}
      />

      {onChangeEmail && (
        <Button
          label="Change email address"
          size="sm"
          variant="text"
          onPress={onChangeEmail}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.three,
  },
  codeCard: {
    gap: Spacing.three,
    paddingVertical: Spacing.four,
  },
  centerText: {
    textAlign: 'center',
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one + 2,
    paddingVertical: Spacing.one + 2,
    paddingHorizontal: Spacing.two + 2,
    borderRadius: Radii.pill,
    alignSelf: 'center',
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.one,
    marginVertical: Spacing.one,
  },
  otpBox: {
    width: 44,
    height: 54,
    borderRadius: Radii.md,
    borderWidth: 1.5,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
  },
});
