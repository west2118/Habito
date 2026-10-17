import { mapFunctionErrorPayload } from '@/lib/auth/gated-signup';

describe('mapFunctionErrorPayload', () => {
  test('maps each server code to its AuthError', () => {
    expect(mapFunctionErrorPayload({ code: 'invalid_email' }).code).toBe('email_address_invalid');
    expect(mapFunctionErrorPayload({ code: 'code_invalid' }).code).toBe('otp_invalid');
    expect(mapFunctionErrorPayload({ code: 'no_pending_code' }).code).toBe('otp_invalid');
    expect(mapFunctionErrorPayload({ code: 'code_expired' }).code).toBe('otp_expired');
    expect(mapFunctionErrorPayload({ code: 'too_many_attempts' }).code).toBe(
      'over_request_rate_limit',
    );
    expect(mapFunctionErrorPayload({ code: 'rate_limited' }).code).toBe('over_request_rate_limit');
    expect(mapFunctionErrorPayload({ code: 'email_exists' }).code).toBe('user_already_exists');
    expect(mapFunctionErrorPayload({ code: 'weak_password' }).code).toBe('weak_password');
    expect(mapFunctionErrorPayload({ code: 'not_configured' }).code).toBe('config_error');
  });

  test('unknown codes degrade to unknown_error', () => {
    expect(mapFunctionErrorPayload({ code: 'something_new' }).code).toBe('unknown_error');
    expect(mapFunctionErrorPayload({}).code).toBe('unknown_error');
    expect(mapFunctionErrorPayload({ code: 42 }).code).toBe('unknown_error');
  });

  test('reuses the server message when it is user-safe copy', () => {
    expect(
      mapFunctionErrorPayload({ code: 'code_expired', message: 'That code expired.' }).message,
    ).toBe('That code expired.');
  });

  test('falls back to default copy without a message', () => {
    const error = mapFunctionErrorPayload({ code: 'code_invalid' });

    expect(error.code).toBe('otp_invalid');
    expect(error.message.length).toBeGreaterThan(0);
  });
});
