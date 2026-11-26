// Mobile number + OTP login.
//
// Two providers:
//  - mockOtpProvider: no SMS is sent, the code is always DEMO_OTP. Used for the
//    web demo and local development.
//  - httpOtpProvider: calls YOUR backend, which sends the SMS through an OTP
//    service (e.g. MSG91, 2Factor, Twilio Verify, or Firebase Auth) and checks
//    the code. Keys for those services must live on the server, never in the app.
//
// The real provider is used automatically when EXPO_PUBLIC_OTP_API_URL is set.

export interface OtpSession {
  userId: string;
  phone: string; // E.164, e.g. +919876543210
  token?: string; // backend session token, if any
}

export interface OtpProvider {
  mock: boolean;
  sendOtp(phone: string): Promise<{ requestId: string }>;
  verifyOtp(phone: string, requestId: string, code: string): Promise<OtpSession>;
}

export const DEMO_OTP = '123456';
export const OTP_LENGTH = 6;
export const RESEND_SECONDS = 30;

/** Accepts 10-digit Indian mobile numbers, with or without +91 / 0. Returns E.164 or null. */
export function normalizeIndianMobile(input: string): string | null {
  let d = input.replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? `+91${d}` : null;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const mockOtpProvider: OtpProvider = {
  mock: true,
  async sendOtp(phone) {
    await wait(400);
    return { requestId: `demo-${phone}-${Date.now()}` };
  },
  async verifyOtp(phone, _requestId, code) {
    await wait(400);
    if (code !== DEMO_OTP) throw new Error('That code is not right. In demo mode the code is ' + DEMO_OTP + '.');
    return { userId: `demo:${phone}`, phone };
  },
};

/**
 * Backend contract (implement on your server):
 *   POST {base}/otp/send    { phone }                    -> { requestId }
 *   POST {base}/otp/verify  { phone, requestId, code }   -> { userId, phone, token }
 * Errors: non-2xx with { message }.
 */
export function httpOtpProvider(base: string): OtpProvider {
  const post = async (path: string, body: unknown) => {
    const res = await fetch(base.replace(/\/$/, '') + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.message ?? `Login service error (${res.status})`);
    return json;
  };
  return {
    mock: false,
    async sendOtp(phone) {
      const r = await post('/otp/send', { phone });
      return { requestId: String(r.requestId) };
    },
    async verifyOtp(phone, requestId, code) {
      const r = await post('/otp/verify', { phone, requestId, code });
      return { userId: String(r.userId), phone: String(r.phone ?? phone), token: r.token };
    },
  };
}

const apiUrl = process.env.EXPO_PUBLIC_OTP_API_URL;
export const otpProvider: OtpProvider = apiUrl ? httpOtpProvider(apiUrl) : mockOtpProvider;
