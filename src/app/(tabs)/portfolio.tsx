import { router } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card, Label, Stat } from '../../components/ui';
import { colors, inr, pct, pnlColor, signedInr } from '../../lib/format';
import { usePortfolio } from '../../lib/PortfolioContext';
import { summarize } from '../../lib/portfolio';

export default function Portfolio() {
  const { state, prices, reset } = usePortfolio();
  const s = summarize(state, prices);

  const confirmReset = () =>
    Alert.alert('Start over?', 'This clears all practice trades and gives you a fresh ₹10 lakh.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: () => reset() },
    ]);

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Card>
        <Label>Total account value</Label>
        <Text style={styles.big}>{inr(s.equity)}</Text>
        <Text style={{ color: pnlColor(s.totalPnl), fontSize: 16, fontWeight: '600' }}>
          {signedInr(s.totalPnl)} ({pct(s.totalPct)}) since you started
        </Text>
        <View style={styles.stats}>
          <Stat label="Cash" value={inr(s.cash)} />
          <Stat label="Invested" value={inr(s.invested)} />
          <Stat label="Booked P&L" value={signedInr(s.realizedPnl)} color={pnlColor(s.realizedPnl)} />
          <Stat label="Open P&L" value={signedInr(s.unrealizedPnl)} color={pnlColor(s.unrealizedPnl)} />
          <Stat label="Win rate" value={s.closedTrades ? `${Math.round(s.winRate * 100)}% of ${s.closedTrades}` : '—'} />
          <Stat label="Winning sells" value={`${s.winningTrades}`} />
        </View>
      </Card>

      <Label style={{ marginTop: 4 }}>Open positions</Label>
      {s.positions.length === 0 ? (
        <Text style={styles.empty}>No open positions. Buy something from Markets to start practising.</Text>
      ) : (
        s.positions.map((p) => (
          <Pressable key={p.symbol} style={styles.row} onPress={() => router.push(`/stock/${p.symbol}`)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sym}>{p.symbol}</Text>
              <Text style={styles.muted}>{p.qty} @ {inr(p.avgPrice)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.sym}>{inr(p.marketValue)}</Text>
              <Text style={{ color: pnlColor(p.unrealizedPnl) }}>{signedInr(p.unrealizedPnl)} ({pct(p.unrealizedPct)})</Text>
            </View>
          </Pressable>
        ))
      )}
      <Text style={styles.muted}>Open P&L uses the latest price seen in the app. Open a stock to refresh it.</Text>

      <Pressable onPress={confirmReset} style={styles.reset}>
        <Text style={{ color: colors.loss, fontWeight: '600' }}>Reset practice account</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  big: { color: colors.text, fontSize: 32, fontWeight: '800', marginVertical: 4 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  row: { flexDirection: 'row', backgroundColor: colors.card, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  sym: { color: colors.text, fontWeight: '700', fontSize: 15 },
  muted: { color: colors.muted, fontSize: 13 },
  empty: { color: colors.muted, paddingVertical: 12 },
  reset: { alignItems: 'center', padding: 14, marginTop: 12 },
});
