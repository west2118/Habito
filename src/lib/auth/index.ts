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
} from './auth';
export type { AuthEvent, AuthStateListener, SignInInput, SignUpInput, SignUpOutput } from './auth';