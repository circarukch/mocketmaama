import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Banner, Button } from '../../components/ui';
import { WatchlistPanel } from '../../components/WatchlistPanel';
import { colors, lakhCrore, pct, pnlColor, signedTok, tok } from '../../lib/format';
import { canClaimDaily, summarize } from '../../lib/portfolio';
import { usePortfolio } from '../../lib/PortfolioContext';
import { useWide } from '../../lib/useLayout';

export default function Home() {
  const wide = useWide();
  return wide ? <Dashboard /> : <WatchlistPanel />;
}

/** Wide screens: the watchlist is in the sidebar, so the home page is a dashboard. */
function Dashboard() {
  const { state, prices } = usePortfolio();
  const s = summarize(state, prices);
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.h1}>Hi, trader</Text>
      <View style={styles.grid}>
        <View style={styles.card}>
          <Text style={styles.k}>Tokens available</Text>
          <Text style={styles.big}>{tok(s.tokens)}</Text>
          <Text style={styles.k}>Held for open orders {tok(s.blocked)} · Started with {lakhCrore(state.startingTokens)}</Text>
          {canClaimDaily(state) ? <View style={{ marginTop: 8, alignSelf: 'flex-start' }}><Button title="Claim today’s free tokens" outline onPress={() => router.navigate('/account')} /></View> : null}
        </View>
        <View style={styles.card}>
          <Text style={styles.k}>Holdings ({s.positions.length})</Text>
          <Text style={[styles.big, { color: pnlColor(s.unrealizedPnl) }]}>{signedTok(s.unrealizedPnl)}</Text>
          <Text style={styles.k}>Current value {tok(s.marketValue)} · Invested {tok(s.invested)}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.k}>Net trading P&L</Text>
          <Text style={[styles.big, { color: pnlColor(s.totalPnl) }]}>{pct(s.totalPct)}</Text>
          <Text style={styles.k}>{signedTok(s.totalPnl)} after {tok(s.charges)} charges · {s.openOrders} open orders</Text>
        </View>
      </View>
      <Text style={styles.tip}>Pick a stock from the watchlist on the left to see its chart and trade.</Text>
      <Banner text="Prices are delayed by about 15 minutes. Practice app with virtual tokens only, not investment advice." />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 24, gap: 16, maxWidth: 1100 },
  h1: { color: colors.text, fontSize: 22, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  card: { flexGrow: 1, flexBasis: 260, padding: 20, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, gap: 6 },
  k: { color: colors.muted, fontSize: 13 },
  big: { color: colors.text, fontSize: 26, fontWeight: '700' },
  tip: { color: colors.muted },
});
