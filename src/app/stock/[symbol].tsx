import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { TradingChart } from '../../components/TradingChart';
import { Banner, Card, Chip, Label, Stat } from '../../components/ui';
import { findInstrument, Timeframe } from '../../lib/data';
import { colors, inr, pct, pnlColor, signedInr } from '../../lib/format';
import { usePortfolio } from '../../lib/PortfolioContext';
import type { Side } from '../../lib/portfolio';
import { useCandles } from '../../lib/useCandles';

const TIMEFRAMES: { key: Timeframe; label: string }[] = [
  { key: '5m', label: '5 min' },
  { key: '1h', label: '1 hour' },
  { key: '1d', label: '1 day' },
];

export default function StockScreen() {
  const { symbol = '' } = useLocalSearchParams<{ symbol: string }>();
  const inst = findInstrument(symbol);
  const [tf, setTf] = useState<Timeframe>('1d');
  const { data, error, loading } = useCandles(symbol, tf, tf === '1d' ? 60_000 : 20_000);
  const { state, order } = usePortfolio();
  const [qty, setQty] = useState('1');
  const [msg, setMsg] = useState<{ text: string; good: boolean } | null>(null);

  const candles = data?.candles ?? [];
  const last = candles[candles.length - 1]?.close;
  const first = candles[0]?.close;
  const pos = state.positions[symbol];
  const trades = useMemo(() => state.trades.filter((t) => t.symbol === symbol), [state.trades, symbol]);
  const qtyNum = Math.max(0, Math.floor(Number(qty) || 0));
  const unreal = pos && last ? (last - pos.avgPrice) * pos.qty : 0;

  const submit = (side: Side) => {
    if (!last) return;
    const r = order({ symbol, side, qty: qtyNum, price: last });
    if (!r.ok) return setMsg({ text: r.error, good: false });
    const t = r.trade;
    if (side === 'BUY') setMsg({ text: `Bought ${t.qty} ${symbol} at ${inr(t.price)}.`, good: true });
    else {
      const p = t.realizedPnl ?? 0;
      setMsg({ text: `Sold ${t.qty} ${symbol} at ${inr(t.price)}. ${p >= 0 ? 'Good call' : 'Loss'}: ${signedInr(p)}.`, good: p >= 0 });
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <Stack.Screen options={{ title: symbol }} />
      <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
        <View>
          <Text style={styles.name}>{inst?.name ?? symbol} · NSE</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
            <Text style={styles.price}>{last ? inr(last) : '…'}</Text>
            {last && first ? <Text style={{ color: pnlColor(last - first) }}>{pct((last / first - 1) * 100)} in view</Text> : null}
          </View>
          {data ? <Text style={styles.source}>Data: {data.source}</Text> : null}
        </View>

        <View style={{ flexDirection: 'row' }}>
          {TIMEFRAMES.map((t) => (
            <Chip key={t.key} label={t.label} active={tf === t.key} onPress={() => setTf(t.key)} />
          ))}
        </View>

        {loading && !data ? (
          <View style={styles.loading}><ActivityIndicator color={colors.accent} /></View>
        ) : error && !data ? (
          <Banner text={`Couldn't load prices: ${error}`} />
        ) : (
          <TradingChart candles={candles} trades={trades} />
        )}
        {data?.simulated ? <Banner text="Live prices are unavailable, so this chart uses simulated prices. Practise freely, but they are not real market moves." /> : null}

        {pos ? (
          <Card>
            <Label>Your position</Label>
            <View style={styles.stats}>
              <Stat label="Quantity" value={String(pos.qty)} />
              <Stat label="Avg buy price" value={inr(pos.avgPrice)} />
              <Stat label="Current value" value={last ? inr(last * pos.qty) : '…'} />
              <Stat label="Unrealised P&L" value={signedInr(unreal)} color={pnlColor(unreal)} />
            </View>
          </Card>
        ) : null}

        <Card>
          <Label>Place a practice order</Label>
          <View style={styles.qtyRow}>
            <Pressable style={styles.step} onPress={() => setQty(String(Math.max(1, qtyNum - 1)))}><Text style={styles.stepText}>−</Text></Pressable>
            <TextInput
              style={styles.qty}
              value={qty}
              onChangeText={(v) => setQty(v.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              selectTextOnFocus
            />
            <Pressable style={styles.step} onPress={() => setQty(String(qtyNum + 1))}><Text style={styles.stepText}>+</Text></Pressable>
          </View>
          <Text style={styles.cost}>
            Order value {last ? inr(last * qtyNum) : '…'} · Cash available {inr(state.cash)}
          </Text>
          <View style={styles.btnRow}>
            <Pressable style={[styles.btn, { backgroundColor: colors.profit }]} onPress={() => submit('BUY')} disabled={!last}>
              <Text style={styles.btnText}>BUY</Text>
            </Pressable>
            <Pressable style={[styles.btn, { backgroundColor: colors.loss }]} onPress={() => submit('SELL')} disabled={!last}>
              <Text style={styles.btnText}>SELL</Text>
            </Pressable>
          </View>
          {msg ? <Text style={[styles.msg, { color: msg.good ? colors.profit : colors.loss }]}>{msg.text}</Text> : null}
          <Text style={styles.hint}>Orders fill instantly at the last chart price. Buy markers show as green arrows on the chart, sells as red.</Text>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  name: { color: colors.muted },
  price: { color: colors.text, fontSize: 30, fontWeight: '700' },
  source: { color: colors.muted, fontSize: 11, marginTop: 2 },
  loading: { height: 320, alignItems: 'center', justifyContent: 'center' },
  stats: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 8 },
  step: { width: 44, height: 44, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  stepText: { color: colors.text, fontSize: 22 },
  qty: { flex: 1, height: 44, borderRadius: 8, borderWidth: 1, borderColor: colors.border, color: colors.text, textAlign: 'center', fontSize: 18 },
  cost: { color: colors.muted, marginTop: 8, fontSize: 13 },
  btnRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  btn: { flex: 1, height: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 16, letterSpacing: 1 },
  msg: { marginTop: 10, fontWeight: '600' },
  hint: { color: colors.muted, fontSize: 12, marginTop: 10 },
});
