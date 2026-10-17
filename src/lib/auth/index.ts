export {
  AUTH_ERROR_MESSAGES,
  createAuthError,
  fail,
  ok,
  toAuthError,
} from './errors';
export type { AuthError, AuthErrorCode, AuthResult } from './errors';

export {
  getActiveSession,
  getCurrentUser,
  onAuthStateChange,
  resendConfirmationEmail,
  sendPasswordResetEmail,
  signIn,
  signOut,
  signUp,
  verifySignUpCode,
} from './auth';
export type { AuthEvent, AuthStateListener, SignInInput, SignUpInput, SignUpOutput } from './auth';
export { confirmSignupCode, mapFunctionErrorPayload, requestSignupCode } from './gated-signup';
export type {
  ConfirmSignupCodeInput,
  FunctionErrorPayload,
  RequestSignupCodeInput,
} from './gated-signup';
export {
  formatVerificationCountdown,
  isVerificationCodeExpired,
  isVerificationCodeFormatValid,
  sanitizeVerificationCodeInput,
  verificationCodeRemainingMs,
  VERIFICATION_CODE_EXPIRY_MINUTES,
  VERIFICATION_CODE_EXPIRY_MS,
  VERIFICATION_CODE_LENGTH,
  VERIFICATION_RESEND_COOLDOWN_SECONDS,
} from './otp';