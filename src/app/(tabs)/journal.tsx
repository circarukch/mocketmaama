import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Card, Label } from '../../components/ui';
import { colors, inr, pnlColor, signedInr, timeIST } from '../../lib/format';
import { usePortfolio } from '../../lib/PortfolioContext';
import { summarize } from '../../lib/portfolio';

export default function Journal() {
  const { state, prices } = usePortfolio();
  const s = summarize(state, prices);

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, gap: 8 }}
      data={state.trades}
      keyExtractor={(t) => t.id}
      ListHeaderComponent={
        s.closedTrades ? (
          <Card style={{ marginBottom: 8 }}>
            <Label>How your decisions went</Label>
            <Text style={styles.verdict}>
              {s.winningTrades} of {s.closedTrades} sells made a profit ({Math.round(s.winRate * 100)}%).
            </Text>
            {s.bestTrade ? <Text style={{ color: colors.profit }}>Best: {s.bestTrade.symbol} {signedInr(s.bestTrade.realizedPnl ?? 0)}</Text> : null}
            {s.worstTrade && s.worstTrade !== s.bestTrade ? (
              <Text style={{ color: pnlColor(s.worstTrade.realizedPnl ?? 0) }}>Worst: {s.worstTrade.symbol} {signedInr(s.worstTrade.realizedPnl ?? 0)}</Text>
            ) : null}
          </Card>
        ) : undefined
      }
      ListEmptyComponent={<Text style={styles.empty}>Your trades will show up here, with the profit or loss of every sell.</Text>}
      renderItem={({ item: t }) => {
        const buy = t.side === 'BUY';
        return (
          <View style={styles.row}>
            <View style={[styles.badge, { backgroundColor: buy ? colors.profit : colors.loss }]}>
              <Text style={styles.badgeText}>{t.side}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sym}>{t.qty} {t.symbol} @ {inr(t.price)}</Text>
              <Text style={styles.muted}>{timeIST(t.time)} IST</Text>
            </View>
            {t.realizedPnl !== undefined ? (
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: pnlColor(t.realizedPnl), fontWeight: '700' }}>{signedInr(t.realizedPnl)}</Text>
                <Text style={[styles.muted, { color: pnlColor(t.realizedPnl) }]}>{t.realizedPnl > 0 ? 'Profit' : t.realizedPnl < 0 ? 'Loss' : 'Break-even'}</Text>
              </View>
            ) : null}
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  verdict: { color: colors.text, fontSize: 16, fontWeight: '600', marginVertical: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { color: '#fff', fontWeight: '800', fontSize: 11 },
  sym: { color: colors.text, fontWeight: '600' },
  muted: { color: colors.muted, fontSize: 12 },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 40 },
});
