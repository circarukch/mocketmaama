import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Divider } from '../../components/ui';
import { computeCharges } from '../../lib/charges';
import { findInstrument } from '../../lib/data';
import { colors, inr, signedInr, tok } from '../../lib/format';
import { buyCost, type OrderType, type Side } from '../../lib/portfolio';
import { usePortfolio } from '../../lib/PortfolioContext';
import { useWide } from '../../lib/useLayout';

/** Kite-style order ticket. Blue for BUY, red for SELL. */
export default function OrderTicket() {
  const params = useLocalSearchParams<{ symbol: string; side: Side; ltp: string }>();
  const symbol = params.symbol ?? '';
  const { state, prices, order, mode } = usePortfolio();
  const ltp = prices[symbol] ?? Number(params.ltp);
  const insets = useSafeAreaInsets();
  const wide = useWide();

  const [side, setSide] = useState<Side>(params.side === 'SELL' ? 'SELL' : 'BUY');
  const [type, setType] = useState<OrderType>('MARKET');
  const [qty, setQty] = useState('1');
  const [limit, setLimit] = useState(ltp ? ltp.toFixed(2) : '');
  const [showCharges, setShowCharges] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buy = side === 'BUY';
  const tint = buy ? colors.accent : colors.sell;
  const qtyNum = Math.max(0, Math.floor(Number(qty) || 0));
  const price = type === 'LIMIT' ? Number(limit) || 0 : ltp || 0;
  const value = qtyNum * price;
  const charges = useMemo(() => computeCharges(side, value), [side, value]);
  const held = state.positions[symbol]?.qty ?? 0;
  const required = buy ? buyCost(qtyNum, price) : 0;

  const submit = async () => {
    setBusy(true);
    setError(null);
    const r = await order({ symbol, side, qty: qtyNum, type, limitPrice: type === 'LIMIT' ? Number(limit) : undefined, ltp });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    router.back();
  };

  return (
    <View style={wide ? styles.backdrop : { flex: 1 }}>
    <KeyboardAvoidingView style={wide ? styles.dialog : { flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.head, { backgroundColor: tint, paddingTop: Platform.OS === 'ios' || wide ? 16 : 16 + insets.top }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headTitle}>{buy ? 'Buy' : 'Sell'} {symbol} <Text style={styles.headEx}>NSE</Text></Text>
          <Text style={styles.headSub}>{findInstrument(symbol)?.name ?? ''} · LTP {ltp ? inr(ltp) : '…'}</Text>
        </View>
        <Pressable onPress={() => setSide(buy ? 'SELL' : 'BUY')} style={styles.toggle} accessibilityLabel="Switch between buy and sell">
          <Text style={{ color: '#fff', fontWeight: '700' }}>{buy ? 'B' : 'S'} ⇄</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }} keyboardShouldPersistTaps="handled">
        <View style={styles.segment}>
          {(['MARKET', 'LIMIT'] as OrderType[]).map((t) => (
            <Pressable key={t} onPress={() => setType(t)} style={[styles.segBtn, type === t && { borderColor: tint, backgroundColor: buy ? '#EEF3FF' : '#FEECEE' }]}>
              <Text style={[styles.segText, type === t && { color: tint }]}>{t === 'MARKET' ? 'Market' : 'Limit'}</Text>
            </Pressable>
          ))}
        </View>

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Qty.</Text>
            <TextInput style={[styles.input, { borderColor: tint }]} value={qty} onChangeText={(v) => setQty(v.replace(/[^0-9]/g, ''))} keyboardType="number-pad" selectTextOnFocus autoFocus />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Price</Text>
            {type === 'LIMIT' ? (
              <TextInput style={[styles.input, { borderColor: tint }]} value={limit} onChangeText={(v) => setLimit(v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" selectTextOnFocus />
            ) : (
              <View style={[styles.input, styles.inputOff]}><Text style={{ color: colors.muted }}>At market</Text></View>
            )}
          </View>
        </View>

        <Text style={styles.note}>
          {type === 'MARKET'
            ? 'Fills now at the latest delayed price.'
            : buy
              ? 'Fills when the price falls to your limit or lower. Tokens are held until it fills or you cancel.'
              : 'Fills when the price rises to your limit or higher.'}
          {mode === 'cloud' ? ' Prices are checked on the server.' : ''}
        </Text>

        <Divider />
        <View style={styles.line}><Text style={styles.muted}>Order value</Text><Text style={styles.val}>{tok(value)}</Text></View>
        <Pressable style={styles.line} onPress={() => setShowCharges((s) => !s)}>
          <Text style={[styles.muted, { color: colors.accent }]}>Charges {showCharges ? '▴' : '▾'}</Text>
          <Text style={styles.val}>{tok(charges.total)}</Text>
        </Pressable>
        {showCharges ? (
          <View style={styles.charges}>
            {[
              ['Brokerage', charges.brokerage],
              ['STT (0.1%)', charges.stt],
              ['Exchange txn', charges.exchange],
              ['SEBI fee', charges.sebi],
              ['Stamp duty', charges.stamp],
              ['GST (18%)', charges.gst],
              ['DP charge', charges.dp],
            ].map(([k, v]) => (
              <View key={k as string} style={styles.line}><Text style={styles.small}>{k}</Text><Text style={styles.small}>{tok(v as number)}</Text></View>
            ))}
            <Text style={styles.small}>Real-world NSE delivery rates, so you learn what trades really cost.</Text>
          </View>
        ) : null}
        {buy ? (
          <View style={styles.line}><Text style={styles.muted}>Tokens required</Text><Text style={[styles.val, required > state.tokens && { color: colors.loss }]}>{tok(required)}</Text></View>
        ) : (
          <View style={styles.line}><Text style={styles.muted}>You hold</Text><Text style={styles.val}>{held} shares</Text></View>
        )}
        <View style={styles.line}><Text style={styles.muted}>Tokens available</Text><Text style={styles.val}>{tok(state.tokens)}</Text></View>
        {!buy && held && price ? (
          <View style={styles.line}>
            <Text style={styles.muted}>Est. P&L on this sell</Text>
            <Text style={[styles.val, { color: price >= state.positions[symbol].avgPrice ? colors.profit : colors.loss }]}>
              {signedInr((price - state.positions[symbol].avgPrice) * Math.min(qtyNum, held))}
            </Text>
          </View>
        ) : null}
        {error ? <Text style={{ color: colors.loss, fontWeight: '600' }}>{error}</Text> : null}
      </ScrollView>

      <View style={[styles.bar, { paddingBottom: 12 + insets.bottom }]}>
        <View style={{ flex: 1 }}><Button title="Cancel" outline color={colors.muted} onPress={() => router.back()} /></View>
        <View style={{ flex: 2 }}>
          <Button title={busy ? 'Placing…' : buy ? 'BUY' : 'SELL'} color={tint} onPress={submit} disabled={busy || qtyNum <= 0 || !(price > 0)} />
        </View>
      </View>
    </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(19,23,34,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  dialog: { width: '100%', maxWidth: 480, maxHeight: '90%', backgroundColor: colors.bg, borderRadius: 8, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 16 },
  headTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  headEx: { fontSize: 11, fontWeight: '600', opacity: 0.8 },
  headSub: { color: '#fff', opacity: 0.9, marginTop: 4, fontSize: 13 },
  toggle: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  segment: { flexDirection: 'row', gap: 8 },
  segBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 4, borderWidth: 1, borderColor: colors.border },
  segText: { color: colors.muted, fontWeight: '600' },
  label: { color: colors.muted, fontSize: 12, marginBottom: 6 },
  input: { height: 48, borderWidth: 1, borderRadius: 4, paddingHorizontal: 12, fontSize: 18, color: colors.text, justifyContent: 'center' },
  inputOff: { borderColor: colors.border, backgroundColor: colors.surface },
  note: { color: colors.muted, fontSize: 12 },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  muted: { color: colors.muted },
  val: { color: colors.text, fontWeight: '600' },
  charges: { backgroundColor: colors.surface, borderRadius: 6, padding: 12, gap: 6 },
  small: { color: colors.muted, fontSize: 12 },
  bar: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
});
