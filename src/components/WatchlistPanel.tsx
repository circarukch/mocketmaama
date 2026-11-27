import Ionicons from '@expo/vector-icons/Ionicons';
import { router, usePathname } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Banner, Divider } from './ui';
import { Instrument, WATCHLIST } from '../lib/data';
import { colors, inr, pct, pnlColor, tok } from '../lib/format';
import { summarize } from '../lib/portfolio';
import { usePortfolio } from '../lib/PortfolioContext';
import { useCandles } from '../lib/useCandles';

function Row({ item, selected }: { item: Instrument; selected: boolean }) {
  const { data } = useCandles(item.symbol, '1d', 60_000);
  const { state } = usePortfolio();
  const c = data?.candles;
  const last = c?.[c.length - 1]?.close;
  const prev = c?.[c.length - 2]?.close;
  const change = last && prev ? last - prev : 0;
  const held = state.positions[item.symbol]?.qty;

  return (
    <Pressable style={({ pressed }) => [styles.row, (pressed || selected) && { backgroundColor: colors.surface }]} onPress={() => (selected ? undefined : router.push(`/stock/${item.symbol}`))}>
      <View style={{ flex: 1 }}>
        <Text style={styles.sym}>{item.symbol}</Text>
        <Text style={styles.sub}>
          NSE{held ? <Text style={{ color: colors.accent }}>  · {held} held</Text> : null}
          {data?.simulated ? <Text style={{ color: colors.warnText }}>  · simulated</Text> : null}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[styles.price, { color: last ? pnlColor(change) : colors.muted }]}>{last ? inr(last) : '…'}</Text>
        {last && prev ? <Text style={styles.sub}>{change >= 0 ? '+' : ''}{change.toFixed(2)} ({pct((change / prev) * 100)})</Text> : null}
      </View>
    </Pressable>
  );
}

/** The watchlist: full screen on phones, the left sidebar on wide screens. */
export function WatchlistPanel() {
  const { state, prices } = usePortfolio();
  const path = usePathname();
  const [q, setQ] = useState('');
  const s = summarize(state, prices);
  const list = useMemo(() => {
    const t = q.trim().toUpperCase();
    return t ? WATCHLIST.filter((i) => i.symbol.includes(t) || i.name.toUpperCase().includes(t)) : WATCHLIST;
  }, [q]);

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      data={list}
      keyExtractor={(i) => i.symbol}
      keyboardShouldPersistTaps="handled"
      ItemSeparatorComponent={Divider}
      ListHeaderComponent={
        <View>
          <Pressable style={styles.funds} onPress={() => router.push('/account')}>
            <View>
              <Text style={styles.fundsLabel}>Tokens available</Text>
              <Text style={styles.fundsValue}>{tok(s.tokens)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.fundsLabel}>Total P&L</Text>
              <Text style={[styles.fundsValue, { color: pnlColor(s.totalPnl) }]}>{pct(s.totalPct)}</Text>
            </View>
          </Pressable>
          <View style={styles.search}>
            <Ionicons name="search" size={18} color={colors.muted} />
            <TextInput style={styles.searchInput} value={q} onChangeText={setQ} placeholder="Search eg: infy, reliance" placeholderTextColor={colors.muted} autoCapitalize="characters" />
            <Text style={styles.count}>{list.length}/{WATCHLIST.length}</Text>
          </View>
          <Divider />
        </View>
      }
      ListFooterComponent={<View style={{ padding: 16 }}><Banner text="Prices are delayed by about 15 minutes. Practice app with virtual tokens only, not investment advice." /></View>}
      renderItem={({ item }) => <Row item={item} selected={path === `/stock/${item.symbol}`} />}
    />
  );
}

const styles = StyleSheet.create({
  funds: { flexDirection: 'row', justifyContent: 'space-between', margin: 16, marginBottom: 8, padding: 14, borderRadius: 8, backgroundColor: colors.surface },
  fundsLabel: { color: colors.muted, fontSize: 12 },
  fundsValue: { color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 2 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, height: 48 },
  searchInput: { flex: 1, fontSize: 15, color: colors.text },
  count: { color: colors.muted, fontSize: 12 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  sym: { color: colors.text, fontSize: 15, fontWeight: '600' },
  sub: { color: colors.muted, fontSize: 12, marginTop: 3 },
  price: { fontSize: 15, fontWeight: '600' },
});
