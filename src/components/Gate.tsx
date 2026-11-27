import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, lakhCrore } from '../lib/format';
import { STARTING_BALANCES } from '../lib/portfolio';
import { usePortfolio } from '../lib/PortfolioContext';
import { supabase } from '../lib/supabase';
import { Banner, Button, Wordmark } from './ui';

/** Shows sign-in or the welcome screen until the user is ready to trade. */
export function Gate({ children }: { children: React.ReactNode }) {
  const { mode, session, ready, onboarded } = usePortfolio();
  if (mode === 'cloud' && !session) return <SignIn />;
  if (!ready) return <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>;
  if (!onboarded) return <Welcome />;
  return <>{children}</>;
}

type AuthMode = 'signin' | 'signup' | 'code';

/** Friendlier wording for the auth errors people actually hit. */
const authError = (m: string) =>
  /rate limit/i.test(m)
    ? 'Too many emails sent for now. Sign in with a password instead, or try the email code again in an hour.'
    : /invalid login credentials/i.test(m)
      ? 'That email and password don’t match. New here? Tap “Create an account”.'
      : /already registered/i.test(m)
        ? 'That email already has an account. Sign in instead.'
        : m;

function SignIn() {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const redirect = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin + window.location.pathname : undefined;

  const run = async (fn: () => Promise<string | null>) => {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const e = await fn();
      if (e) setError(authError(e));
    } finally {
      setBusy(false);
    }
  };

  const signIn = () => run(async () => (await supabase!.auth.signInWithPassword({ email: email.trim(), password })).error?.message ?? null);
  const signUp = () =>
    run(async () => {
      const { data, error: e } = await supabase!.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: redirect } });
      if (e) return e.message;
      // With "Confirm email" off in Supabase you're signed in straight away; otherwise a confirmation email is sent.
      if (!data.session) setInfo('Check your email to confirm your account, then sign in here.');
      return null;
    });
  const sendCode = () =>
    run(async () => {
      const { error: e } = await supabase!.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true, emailRedirectTo: redirect } });
      if (!e) setSent(true);
      return e?.message ?? null;
    });
  const verify = () => run(async () => (await supabase!.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' })).error?.message ?? null);

  const emailOk = /^\S+@\S+\.\S+$/.test(email.trim());
  const pwOk = password.length >= 6;
  const switchTo = (m: AuthMode) => {
    setMode(m);
    setError(null);
    setInfo(null);
    setSent(false);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <Wordmark size={30} />
        <Text style={styles.tag}>Learn to trade with free virtual tokens.</Text>
        <Text style={styles.h1}>{mode === 'signup' ? 'Create your account' : 'Sign in'}</Text>

        {mode !== 'code' || !sent ? (
          <>
            <Text style={styles.field}>Email</Text>
            <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" placeholder="you@example.com" placeholderTextColor={colors.muted} />
          </>
        ) : null}

        {mode === 'code' ? (
          !sent ? (
            <Button title={busy ? 'Sending…' : 'Email me a sign-in code'} onPress={sendCode} disabled={busy || !emailOk} />
          ) : (
            <>
              <Text style={styles.field}>Enter the 6-digit code sent to {email}</Text>
              <Text style={styles.small}>Or tap the link in that email to sign in straight away.</Text>
              <TextInput style={styles.input} value={code} onChangeText={(v) => setCode(v.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={8} placeholder="123456" placeholderTextColor={colors.muted} />
              <Button title={busy ? 'Checking…' : 'Sign in'} onPress={verify} disabled={busy || code.length < 6} />
            </>
          )
        ) : (
          <>
            <Text style={styles.field}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              placeholder={mode === 'signup' ? 'At least 6 characters' : 'Your password'}
              placeholderTextColor={colors.muted}
              onSubmitEditing={() => emailOk && pwOk && (mode === 'signup' ? signUp() : signIn())}
            />
            {mode === 'signup' ? (
              <Button title={busy ? 'Creating…' : 'Create account'} onPress={signUp} disabled={busy || !emailOk || !pwOk} />
            ) : (
              <Button title={busy ? 'Signing in…' : 'Sign in'} onPress={signIn} disabled={busy || !emailOk || !pwOk} />
            )}
          </>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {info ? <Text style={styles.info}>{info}</Text> : null}

        <View style={{ gap: 4, marginTop: 8 }}>
          {mode !== 'signin' ? <Pressable onPress={() => switchTo('signin')}><Text style={styles.link}>Have an account? Sign in with password</Text></Pressable> : null}
          {mode !== 'signup' ? <Pressable onPress={() => switchTo('signup')}><Text style={styles.link}>New here? Create an account</Text></Pressable> : null}
          {mode !== 'code' ? <Pressable onPress={() => switchTo('code')}><Text style={styles.link}>Sign in with an email code instead</Text></Pressable> : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Welcome() {
  const { completeOnboarding } = usePortfolio();
  const [pick, setPick] = useState<number>(1_000_000);
  const [adult, setAdult] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setBusy(true);
    try {
      await completeOnboarding(pick);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.page}>
      <Wordmark size={30} />
      <Text style={styles.h1}>Practise trading on real Indian stocks, risk free.</Text>
      <Text style={styles.tag}>You trade with virtual tokens. 1 token buys ₹1 of stock. Tokens are free and can never be bought, withdrawn or swapped for money.</Text>

      <Text style={styles.field}>How many tokens do you want to start with?</Text>
      {STARTING_BALANCES.map((b) => (
        <Pressable key={b} onPress={() => setPick(b)} style={[styles.option, pick === b && styles.optionOn]}>
          <View style={[styles.radio, pick === b && styles.radioOn]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.optionTitle}>{lakhCrore(b)} tokens</Text>
            <Text style={styles.optionSub}>
              {b === 100_000 ? 'Like a first small account. Every rupee counts.' : b === 1_000_000 ? 'A typical starting portfolio. Recommended.' : 'Big-money practice. Try F&O-sized positions later.'}
            </Text>
          </View>
        </Pressable>
      ))}
      <Text style={styles.small}>You can start over with a different amount at any time from Account.</Text>

      <Pressable onPress={() => setAdult((a) => !a)} style={styles.check}>
        <View style={[styles.box, adult && styles.boxOn]}>{adult ? <Text style={{ color: '#fff', fontWeight: '800' }}>✓</Text> : null}</View>
        <Text style={{ color: colors.text, flex: 1 }}>I am 18 or older and understand this is a practice app, not investment advice.</Text>
      </Pressable>

      <Button title={busy ? 'Setting up…' : 'Start trading'} onPress={start} disabled={!adult || busy} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={{ marginTop: 16 }}>
        <Banner text="Prices are delayed by about 15 minutes. Mocket Maama is not a broker and no real trades are placed." />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  page: { padding: 24, paddingTop: 72, gap: 12, flexGrow: 1, width: '100%', maxWidth: 560, alignSelf: 'center' },
  h1: { color: colors.text, fontSize: 22, fontWeight: '700', marginTop: 12 },
  tag: { color: colors.muted, fontSize: 15, lineHeight: 21 },
  field: { color: colors.text, fontWeight: '600', marginTop: 16 },
  input: { height: 48, borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingHorizontal: 12, fontSize: 16, color: colors.text },
  link: { color: colors.accent, textAlign: 'center', marginTop: 8 },
  error: { color: colors.loss, marginTop: 4 },
  info: { color: colors.profit, marginTop: 4 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 14 },
  optionOn: { borderColor: colors.accent, backgroundColor: '#F3F6FF' },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: colors.border },
  radioOn: { borderColor: colors.accent, borderWidth: 6 },
  optionTitle: { color: colors.text, fontWeight: '700', fontSize: 16 },
  optionSub: { color: colors.muted, fontSize: 13, marginTop: 2 },
  small: { color: colors.muted, fontSize: 12 },
  check: { flexDirection: 'row', gap: 12, alignItems: 'center', marginVertical: 12 },
  box: { width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
});
