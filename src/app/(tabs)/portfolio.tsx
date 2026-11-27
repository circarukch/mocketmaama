import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Divider } from '../../components/ui';
import { colors, inr, pct, pnlColor, signedInr, signedTok, tok } from '../../lib/format';
import { summarize } from '../../lib/portfolio';
import { usePortfolio } from '../../lib/PortfolioContext';

export default function Portfolio() {
  const { state, prices } = usePortfolio();
  const s = summarize(state, prices);

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      data={s.positions}
      keyExtractor={(p) => p.symbol}
      ItemSeparatorComponent={Divider}
      ListHeaderComponent={
        <View>
          <View style={styles.summary}>
            <View style={styles.split}>
              <View><Text style={styles.k}>Invested</Text><Text style={styles.v}>{tok(s.invested)}</Text></View>
              <View style={{ alignItems: 'flex-end' }}><Text style={styles.k}>Current</Text><Text style={styles.v}>{tok(s.marketValue)}</Text></View>
            </View>
            <Divider />
            <View style={[styles.split, { marginTop: 10 }]}>
              <Text style={styles.k}>Holdings P&L</Text>
              <Text style={[styles.v, { color: pnlColor(s.unrealizedPnl) }]}>{signedTok(s.unrealizedPnl)}</Text>
            </View>
            <View style={styles.split}>
              <Text style={styles.k}>Booked P&L (before charges)</Text>
              <Text style={[styles.v, { color: pnlColor(s.realizedPnl) }]}>{signedTok(s.realizedPnl)}</Text>
            </View>
            <View style={styles.split}>
              <Text style={styles.k}>Charges paid</Text>
              <Text style={styles.v}>{tok(s.charges)}</Text>
            </View>
            <View style={styles.split}>
              <Text style={[styles.k, { color: colors.text, fontWeight: '700' }]}>Net trading P&L</Text>
              <Text style={[styles.v, { color: pnlColor(s.totalPnl) }]}>{signedTok(s.totalPnl)} ({pct(s.totalPct)})</Text>
            </View>
            <View style={styles.split}>
              <Text style={styles.k}>Win rate</Text>
              <Text style={styles.v}>{s.closedTrades ? `${Math.round(s.winRate * 100)}% of ${s.closedTrades} sells` : '—'}</Text>
            </View>
            {s.bestTrade ? (
              <Text style={styles.small}>
                Best call: {s.bestTrade.symbol} <Text style={{ color: pnlColor(s.bestTrade.realizedPnl ?? 0) }}>{signedInr(s.bestTrade.realizedPnl ?? 0)}</Text>
                {s.worstTrade && s.worstTrade !== s.bestTrade ? (
                  <>   Worst: {s.worstTrade.symbol} <Text style={{ color: pnlColor(s.worstTrade.realizedPnl ?? 0) }}>{signedInr(s.worstTrade.realizedPnl ?? 0)}</Text></>
                ) : null}
              </Text>
            ) : null}
          </View>
          <Text style={styles.section}>Holdings ({s.positions.length})</Text>
          <Divider />
        </View>
      }
      ListEmptyComponent={<Text style={styles.empty}>No holdings yet. Pick a stock from your Watchlist and tap BUY.</Text>}
      renderItem={({ item: p }) => (
        <Pressable style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surface }]} onPress={() => router.push(`/stock/${p.symbol}`)}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.muted}>Qty. {p.qty} · Avg. {inr(p.avgPrice)}</Text>
            <Text style={styles.sym}>{p.symbol}</Text>
            <Text style={styles.muted}>Invested {tok(p.qty * p.avgPrice)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <Text style={[styles.muted, { color: pnlColor(p.unrealizedPct) }]}>{pct(p.unrealizedPct)}</Text>
            <Text style={[styles.sym, { color: pnlColor(p.unrealizedPnl) }]}>{signedInr(p.unrealizedPnl)}</Text>
            <Text style={styles.muted}>LTP {inr(p.lastPrice)}</Text>
          </View>
        </Pressable>
      )}
      ListFooterComponent={<Text style={[styles.small, { padding: 16 }]}>P&L uses the latest price seen in the app. Open a stock to refresh it.</Text>}
    />
  );
}

const styles = StyleSheet.create({
  summary: { margin: 16, padding: 16, borderRadius: 8, backgroundColor: colors.surface, gap: 6 },
  split: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 2 },
  k: { color: colors.muted, fontSize: 13 },
  v: { color: colors.text, fontSize: 15, fontWeight: '600' },
  small: { color: colors.muted, fontSize: 12, marginTop: 6 },
  section: { color: colors.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 16, paddingBottom: 8 },
  empty: { color: colors.muted, padding: 16 },
  row: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12 },
  sym: { color: colors.text, fontWeight: '600', fontSize: 15 },
  muted: { color: colors.muted, fontSize: 12 },
});
