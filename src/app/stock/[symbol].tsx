import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TradingChart } from '../../components/TradingChart';
import { Banner, Button, Card, Chip, Label, Stat } from '../../components/ui';
import { findInstrument, Timeframe } from '../../lib/data';
import { colors, inr, pct, pnlColor, signedInr } from '../../lib/format';
import { usePortfolio } from '../../lib/PortfolioContext';
import { useCandles } from '../../lib/useCandles';

const TIMEFRAMES: { key: Timeframe; label: string }[] = [
  { key: '5m', label: '5m' },
  { key: '1h', label: '1h' },
  { key: '1d', label: '1D' },
];

export default function StockScreen() {
  const { symbol = '' } = useLocalSearchParams<{ symbol: string }>();
  const inst = findInstrument(symbol);
  const [tf, setTf] = useState<Timeframe>('1d');
  const { data, error, loading } = useCandles(symbol, tf, tf === '1d' ? 60_000 : 20_000);
  const { state, prices } = usePortfolio();
  const insets = useSafeAreaInsets();

  const candles = data?.candles ?? [];
  const last = prices[symbol] ?? candles[candles.length - 1]?.close;
  const prev = candles[candles.length - 2]?.close;
  const pos = state.positions[symbol];
  const trades = useMemo(() => state.trades.filter((t) => t.symbol === symbol), [state.trades, symbol]);
  const unreal = pos && last ? (last - pos.avgPrice) * pos.qty : 0;
  const open = (side: 'BUY' | 'SELL') => router.push({ pathname: '/order/[symbol]', params: { symbol, side, ltp: String(last ?? '') } });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: symbol }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <View>
          <Text style={styles.name}>{inst?.name ?? symbol} · NSE</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
            <Text style={styles.price}>{last ? inr(last) : '…'}</Text>
            {last && prev ? <Text style={{ color: pnlColor(last - prev), fontWeight: '600' }}>{signedInr(last - prev)} ({pct((last / prev - 1) * 100)})</Text> : null}
          </View>
          {data ? <Text style={styles.source}>{data.source}</Text> : null}
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
            <Label>Your holding</Label>
            <View style={styles.stats}>
              <Stat label="Qty" value={String(pos.qty)} />
              <Stat label="Avg. price" value={inr(pos.avgPrice)} />
              <Stat label="Current value" value={last ? inr(last * pos.qty) : '…'} />
              <Stat label="P&L" value={signedInr(unreal)} color={pnlColor(unreal)} />
            </View>
          </Card>
        ) : null}
        <Text style={styles.hint}>Your buys and sells show as arrows on the chart.</Text>
      </ScrollView>

      <View style={[styles.bar, { paddingBottom: 12 + insets.bottom }]}>
        <View style={{ flex: 1 }}><Button title="BUY" onPress={() => open('BUY')} disabled={!last} /></View>
        <View style={{ flex: 1 }}><Button title="SELL" color={colors.sell} onPress={() => open('SELL')} disabled={!last} /></View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  name: { color: colors.muted },
  price: { color: colors.text, fontSize: 28, fontWeight: '700' },
  source: { color: colors.muted, fontSize: 11, marginTop: 2 },
  loading: { height: 320, alignItems: 'center', justifyContent: 'center' },
  stats: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  hint: { color: colors.muted, fontSize: 12 },
  bar: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.bg },
});
