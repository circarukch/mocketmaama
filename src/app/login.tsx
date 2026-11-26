import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Banner } from '../components/ui';
import { useAuth } from '../lib/auth/AuthContext';
import { DEMO_OTP, normalizeIndianMobile, OTP_LENGTH, otpProvider, RESEND_SECONDS } from '../lib/auth/otp';
import { colors } from '../lib/format';

type Step = { kind: 'phone' } | { kind: 'otp'; phone: string; requestId: string };

export default function Login() {
  const { signIn } = useAuth();
  const [step, setStep] = useState<Step>({ kind: 'phone' });
  const [mobile, setMobile] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [resendIn]);

  const phone = normalizeIndianMobile(mobile);

  const send = async (target: string) => {
    setBusy(true);
    setError(null);
    try {
      const { requestId } = await otpProvider.sendOtp(target);
      setStep({ kind: 'otp', phone: target, requestId });
      setCode('');
      setResendIn(RESEND_SECONDS);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the OTP. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const verify = async (value = code) => {
    if (step.kind !== 'otp' || value.length !== OTP_LENGTH) return;
    setBusy(true);
    setError(null);
    try {
      signIn(await otpProvider.verifyOtp(step.phone, step.requestId, value));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not verify the OTP.');
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={styles.inner} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.brand}>
          <View style={styles.logo}><Text style={styles.logoText}>M</Text></View>
          <Text style={styles.title}>Mocket Maama</Text>
          <Text style={styles.tag}>Practise trading with tokens. See if your calls make a profit or a loss.</Text>
        </View>

        {step.kind === 'phone' ? (
          <View style={styles.form}>
            <Text style={styles.label}>Mobile number</Text>
            <View style={styles.phoneRow}>
              <View style={styles.cc}><Text style={styles.ccText}>+91</Text></View>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={mobile}
                onChangeText={(v) => setMobile(v.replace(/[^0-9 ]/g, '').slice(0, 11))}
                placeholder="98765 43210"
                placeholderTextColor={colors.muted}
                keyboardType="phone-pad"
                autoComplete="tel"
                textContentType="telephoneNumber"
                maxLength={11}
                onSubmitEditing={() => phone && send(phone)}
              />
            </View>
            <Pressable style={[styles.btn, (!phone || busy) && styles.btnOff]} disabled={!phone || busy} onPress={() => phone && send(phone)}>
              {busy ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.btnText}>Get OTP</Text>}
            </Pressable>
          </View>
        ) : (
          <View style={styles.form}>
            <Text style={styles.label}>Enter the {OTP_LENGTH}-digit code sent to {step.phone.replace('+91', '+91 ')}</Text>
            <TextInput
              autoFocus
              style={[styles.input, styles.otp]}
              value={code}
              onChangeText={(v) => {
                const c = v.replace(/\D/g, '').slice(0, OTP_LENGTH);
                setCode(c);
                if (c.length === OTP_LENGTH) verify(c);
              }}
              keyboardType="number-pad"
              autoComplete="sms-otp"
              textContentType="oneTimeCode"
              maxLength={OTP_LENGTH}
              placeholder={'•'.repeat(OTP_LENGTH)}
              placeholderTextColor={colors.muted}
            />
            <Pressable style={[styles.btn, (code.length !== OTP_LENGTH || busy) && styles.btnOff]} disabled={code.length !== OTP_LENGTH || busy} onPress={() => verify()}>
              {busy ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.btnText}>Verify and continue</Text>}
            </Pressable>
            <View style={styles.links}>
              <Pressable onPress={() => { setStep({ kind: 'phone' }); setError(null); }}>
                <Text style={styles.link}>Change number</Text>
              </Pressable>
              <Pressable disabled={resendIn > 0 || busy} onPress={() => send(step.phone)}>
                <Text style={[styles.link, resendIn > 0 && { color: colors.muted }]}>{resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend OTP'}</Text>
              </Pressable>
            </View>
          </View>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {otpProvider.mock ? (
          <View style={{ marginTop: 16 }}>
            <Banner text={`Demo mode: no SMS is sent. Use any Indian mobile number and the code ${DEMO_OTP}.`} />
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  inner: { flex: 1, padding: 24, justifyContent: 'center', maxWidth: 480, width: '100%', alignSelf: 'center' },
  brand: { alignItems: 'center', marginBottom: 32 },
  logo: { width: 64, height: 64, borderRadius: 18, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: colors.bg, fontSize: 34, fontWeight: '900' },
  title: { color: colors.text, fontSize: 28, fontWeight: '800', marginTop: 14 },
  tag: { color: colors.muted, textAlign: 'center', marginTop: 6, fontSize: 15 },
  form: { gap: 12 },
  label: { color: colors.muted, fontSize: 14 },
  phoneRow: { flexDirection: 'row', gap: 8 },
  cc: { height: 52, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', backgroundColor: colors.card },
  ccText: { color: colors.text, fontSize: 18 },
  input: { height: 52, minWidth: 0, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, color: colors.text, fontSize: 18, paddingHorizontal: 14 },
  otp: { textAlign: 'center', letterSpacing: 10, fontSize: 24 },
  btn: { height: 52, borderRadius: 10, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  btnOff: { opacity: 0.45 },
  btnText: { color: colors.bg, fontWeight: '800', fontSize: 16 },
  links: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  link: { color: colors.accent, fontWeight: '600', padding: 4 },
  error: { color: colors.loss, marginTop: 14, textAlign: 'center' },
});
