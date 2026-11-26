import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Banner } from '../../components/ui';
import { Instrument, WATCHLIST } from '../../lib/data';
import { colors, inr, pct, pnlColor, tokens } from '../../lib/format';
import { usePortfolio } from '../../lib/PortfolioContext';
import { useCandles } from '../../lib/useCandles';

function Header() {
  const { state } = usePortfolio();
  return (
    <View style={{ marginBottom: 8 }}>
      <View style={styles.balance}>
        <Text style={styles.balLabel}>Token balance</Text>
        <Text style={styles.balValue}>{tokens(state.cash)}</Text>
      </View>
      <Text style={styles.h1}>Pick a scrip and practise</Text>
      <Text style={styles.sub}>Open a chart, then buy or sell with tokens. 1 token = ₹1 of practice value. No real money is used.</Text>
    </View>
  );
}

function Row({ item }: { item: Instrument }) {
  const { data } = useCandles(item.symbol, '1d', 60_000);
  const { state } = usePortfolio();
  const c = data?.candles;
  const last = c?.[c.length - 1]?.close;
  const prev = c?.[c.length - 2]?.close;
  const change = last && prev ? (last / prev - 1) * 100 : 0;
  const held = state.positions[item.symbol]?.qty;

  return (
    <Pressable style={styles.row} onPress={() => router.push(`/stock/${item.symbol}`)}>
      <View style={{ flex: 1 }}>
        <Text style={styles.sym}>
          {item.symbol} {held ? <Text style={styles.held}>· {held} held</Text> : null}
        </Text>
        <Text style={styles.name}>{item.name}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={styles.price}>{last ? inr(last) : '…'}</Text>
        {last ? <Text style={{ color: pnlColor(change), fontSize: 13 }}>{pct(change)}</Text> : null}
        {data?.simulated ? <Text style={styles.sim}>simulated</Text> : null}
      </View>
    </Pressable>
  );
}

export default function Markets() {
  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, gap: 8 }}
      data={WATCHLIST}
      keyExtractor={(i) => i.symbol}
      ListHeaderComponent={<Header />}
      ListFooterComponent={<View style={{ marginTop: 8 }}><Banner text="Prices may be delayed or simulated. This is a practice app with tokens, not investment advice." /></View>}
      renderItem={({ item }) => <Row item={item} />}
    />
  );
}

const styles = StyleSheet.create({
  balance: { backgroundColor: colors.card, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.accent, marginBottom: 14 },
  balLabel: { color: colors.muted, fontSize: 12 },
  balValue: { color: colors.accent, fontSize: 22, fontWeight: '800', marginTop: 2 },
  h1: { color: colors.text, fontSize: 20, fontWeight: '700' },
  sub: { color: colors.muted, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  sym: { color: colors.text, fontSize: 16, fontWeight: '700' },
  held: { color: colors.accent, fontSize: 13, fontWeight: '500' },
  name: { color: colors.muted, fontSize: 13, marginTop: 2 },
  price: { color: colors.text, fontSize: 16, fontWeight: '600' },
  sim: { color: colors.accent, fontSize: 10, marginTop: 2 },
});
