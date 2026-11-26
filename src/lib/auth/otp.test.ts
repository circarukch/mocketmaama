import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_OTP, mockOtpProvider, normalizeIndianMobile } from './otp.ts';

test('normalizes Indian mobile numbers', () => {
  assert.equal(normalizeIndianMobile('98765 43210'), '+919876543210');
  assert.equal(normalizeIndianMobile('+91-9876543210'), '+919876543210');
  assert.equal(normalizeIndianMobile('09876543210'), '+919876543210');
  assert.equal(normalizeIndianMobile('5876543210'), null); // must start 6-9
  assert.equal(normalizeIndianMobile('98765'), null);
});

test('demo OTP accepts only the demo code', async () => {
  const { requestId } = await mockOtpProvider.sendOtp('+919876543210');
  await assert.rejects(mockOtpProvider.verifyOtp('+919876543210', requestId, '000000'));
  const s = await mockOtpProvider.verifyOtp('+919876543210', requestId, DEMO_OTP);
  assert.equal(s.phone, '+919876543210');
});
