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

function SignIn() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setBusy(true);
    setError(null);
    const { error: e } = await supabase!.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
    setBusy(false);
    if (e) setError(e.message);
    else setSent(true);
  };
  const verify = async () => {
    setBusy(true);
    setError(null);
    const { error: e } = await supabase!.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
    setBusy(false);
    if (e) setError(e.message);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.page}>
        <Wordmark size={30} />
        <Text style={styles.tag}>Learn to trade with free virtual tokens.</Text>
        {!sent ? (
          <>
            <Text style={styles.field}>Email</Text>
            <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="you@example.com" placeholderTextColor={colors.muted} />
            <Button title={busy ? 'Sending…' : 'Get sign-in code'} onPress={send} disabled={busy || !email.includes('@')} />
          </>
        ) : (
          <>
            <Text style={styles.field}>Enter the code sent to {email}</Text>
            <TextInput style={styles.input} value={code} onChangeText={(v) => setCode(v.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={8} placeholder="123456" placeholderTextColor={colors.muted} />
            <Button title={busy ? 'Checking…' : 'Sign in'} onPress={verify} disabled={busy || code.length < 6} />
            <Pressable onPress={() => setSent(false)}><Text style={styles.link}>Use a different email</Text></Pressable>
          </>
        )}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
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
