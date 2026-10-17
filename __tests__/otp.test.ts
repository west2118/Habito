import {
  formatVerificationCountdown,
  isVerificationCodeExpired,
  isVerificationCodeFormatValid,
  sanitizeVerificationCodeInput,
  verificationCodeRemainingMs,
  VERIFICATION_CODE_EXPIRY_MS,
} from '@/lib/auth/otp';

describe('isVerificationCodeFormatValid', () => {
  test('accepts exactly six digits', () => {
    expect(isVerificationCodeFormatValid('123456')).toBe(true);
    expect(isVerificationCodeFormatValid('  123456  ')).toBe(true);
  });

  test('rejects anything else', () => {
    expect(isVerificationCodeFormatValid('12345')).toBe(false);
    expect(isVerificationCodeFormatValid('1234567')).toBe(false);
    expect(isVerificationCodeFormatValid('12345a')).toBe(false);
    expect(isVerificationCodeFormatValid('')).toBe(false);
    expect(isVerificationCodeFormatValid('12 3456')).toBe(false);
  });
});

describe('sanitizeVerificationCodeInput', () => {
  test('keeps digits only, capped at six', () => {
    expect(sanitizeVerificationCodeInput('12a34b5678')).toBe('123456');
    expect(sanitizeVerificationCodeInput('  42 ')).toBe('42');
    expect(sanitizeVerificationCodeInput('')).toBe('');
  });
});

describe('verification code expiry', () => {
  const sentAt = 1_000_000;

  test('is valid inside the 15-minute window', () => {
    expect(isVerificationCodeExpired(sentAt, sentAt + VERIFICATION_CODE_EXPIRY_MS - 1)).toBe(
      false,
    );
  });

  test('expires exactly at 15 minutes', () => {
    expect(isVerificationCodeExpired(sentAt, sentAt + VERIFICATION_CODE_EXPIRY_MS)).toBe(true);
    expect(isVerificationCodeExpired(sentAt, sentAt + VERIFICATION_CODE_EXPIRY_MS + 60_000)).toBe(
      true,
    );
  });

  test('remaining time counts down to zero', () => {
    expect(verificationCodeRemainingMs(sentAt, sentAt)).toBe(VERIFICATION_CODE_EXPIRY_MS);
    expect(verificationCodeRemainingMs(sentAt, sentAt + VERIFICATION_CODE_EXPIRY_MS + 1)).toBe(0);
  });
});

describe('formatVerificationCountdown', () => {
  test('renders M:SS', () => {
    expect(formatVerificationCountdown(15 * 60_000)).toBe('15:00');
    expect(formatVerificationCountdown(14 * 60_000 + 3_000)).toBe('14:03');
    expect(formatVerificationCountdown(59_000)).toBe('0:59');
    expect(formatVerificationCountdown(0)).toBe('0:00');
    expect(formatVerificationCountdown(-5_000)).toBe('0:00');
  });
});
