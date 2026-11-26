import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Card, Label, Stat } from '../../components/ui';
import { useAuth } from '../../lib/auth/AuthContext';
import { colors, pct, pnlColor, signedTokens, tok, tokens } from '../../lib/format';
import { usePortfolio } from '../../lib/PortfolioContext';
import { summarize } from '../../lib/portfolio';

const PRESETS = [10_000, 50_000, 1_00_000];

export default function Wallet() {
  const { state, prices, reset, addTokens } = usePortfolio();
  const { session, signOut } = useAuth();
  const s = summarize(state, prices);
  const [custom, setCustom] = useState('');
  const [note, setNote] = useState<{ text: string; good: boolean } | null>(null);
  // Two-tap confirm, built into the screen so it works on iOS, Android and web.
  const [confirming, setConfirming] = useState(false);

  const add = (amount: number) => {
    const r = addTokens(amount);
    setNote(r.ok ? { text: `Added ${tokens(amount, 0)}.`, good: true } : { text: r.error, good: false });
    if (r.ok) setCustom('');
  };

  const onReset = () => {
    if (!confirming) return setConfirming(true);
    reset();
    setConfirming(false);
    setNote(null);
  };

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
      <Card style={{ borderColor: colors.accent }}>
        <Label>Token balance</Label>
        <Text style={styles.big}>{tok(state.cash)}</Text>
        <Text style={styles.muted}>tokens ready to trade · 1 token = ₹1 of practice value</Text>

        <Text style={[styles.section, { marginTop: 16 }]}>Add tokens (free)</Text>
        <View style={styles.presets}>
          {PRESETS.map((p) => (
            <Pressable key={p} style={styles.preset} onPress={() => add(p)}>
              <Text style={styles.presetText}>+{tok(p, 0)}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.customRow}>
          <TextInput
            style={styles.input}
            value={custom}
            onChangeText={(v) => setCustom(v.replace(/[^0-9]/g, '').slice(0, 7))}
            placeholder="Other amount"
            placeholderTextColor={colors.muted}
            keyboardType="number-pad"
          />
          <Pressable style={[styles.addBtn, !custom && { opacity: 0.45 }]} disabled={!custom} onPress={() => add(Number(custom))}>
            <Text style={styles.addText}>Add</Text>
          </Pressable>
        </View>
        {note ? <Text style={{ color: note.good ? colors.profit : colors.loss, marginTop: 8, fontWeight: '600' }}>{note.text}</Text> : null}
      </Card>

      <Card>
        <Label>Your results in tokens</Label>
        <Text style={{ color: pnlColor(s.totalPnl), fontSize: 22, fontWeight: '800', marginTop: 4 }}>
          {signedTokens(s.totalPnl)} ({pct(s.totalPct)})
        </Text>
        <Text style={styles.muted}>Account value {tokens(s.equity)} vs {tokens(s.funded, 0)} put in (welcome tokens + top-ups)</Text>
        <View style={styles.stats}>
          <Stat label="Booked P&L" value={signedTokens(s.realizedPnl)} color={pnlColor(s.realizedPnl)} />
          <Stat label="Open P&L" value={signedTokens(s.unrealizedPnl)} color={pnlColor(s.unrealizedPnl)} />
          <Stat label="In open trades" value={tokens(s.invested)} />
          <Stat label="Win rate" value={s.closedTrades ? `${Math.round(s.winRate * 100)}% of ${s.closedTrades}` : '—'} />
        </View>
      </Card>

      <Label style={{ marginTop: 4 }}>Open positions</Label>
      {s.positions.length === 0 ? (
        <Text style={styles.empty}>No open positions. Pick a scrip to start practising.</Text>
      ) : (
        s.positions.map((p) => (
          <Pressable key={p.symbol} style={styles.row} onPress={() => router.push(`/stock/${p.symbol}`)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sym}>{p.symbol}</Text>
              <Text style={styles.muted}>{p.qty} @ {tok(p.avgPrice)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.sym}>{tokens(p.marketValue)}</Text>
              <Text style={{ color: pnlColor(p.unrealizedPnl) }}>{signedTokens(p.unrealizedPnl)} ({pct(p.unrealizedPct)})</Text>
            </View>
          </Pressable>
        ))
      )}
      <Text style={styles.muted}>Open P&L uses the latest price seen in the app. Open a scrip to refresh it.</Text>

      <Card style={{ marginTop: 8 }}>
        <Label>Account</Label>
        <Text style={[styles.sym, { marginTop: 4 }]}>{session?.phone.replace('+91', '+91 ')}</Text>
        <Pressable onPress={onReset} style={[styles.reset, confirming && styles.resetConfirm]}>
          <Text style={{ color: confirming ? '#fff' : colors.loss, fontWeight: '600', textAlign: 'center' }}>
            {confirming ? 'Tap again to clear all trades and start over with fresh welcome tokens' : 'Reset practice account'}
          </Text>
        </Pressable>
        {confirming ? (
          <Pressable onPress={() => setConfirming(false)} style={styles.reset}>
            <Text style={{ color: colors.muted }}>Cancel</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={signOut} style={styles.reset}>
          <Text style={{ color: colors.text, fontWeight: '600' }}>Log out</Text>
        </Pressable>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  big: { color: colors.accent, fontSize: 34, fontWeight: '800', marginTop: 4 },
  section: { color: colors.text, fontWeight: '700' },
  presets: { flexDirection: 'row', gap: 8, marginTop: 8 },
  preset: { flex: 1, height: 44, borderRadius: 10, borderWidth: 1, borderColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  presetText: { color: colors.accent, fontWeight: '700' },
  customRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  input: { flex: 1, width: 0, minWidth: 0, height: 44, borderRadius: 10, borderWidth: 1, borderColor: colors.border, color: colors.text, paddingHorizontal: 12, fontSize: 16 },
  addBtn: { height: 44, paddingHorizontal: 20, borderRadius: 10, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  addText: { color: colors.bg, fontWeight: '800' },
  stats: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  row: { flexDirection: 'row', backgroundColor: colors.card, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  sym: { color: colors.text, fontWeight: '700', fontSize: 15 },
  muted: { color: colors.muted, fontSize: 13 },
  empty: { color: colors.muted, paddingVertical: 12 },
  reset: { alignItems: 'center', padding: 12, marginTop: 8, borderRadius: 10 },
  resetConfirm: { backgroundColor: colors.loss },
});
