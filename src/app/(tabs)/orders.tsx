import { useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { Divider } from '../../components/ui';
import { confirm } from '../../lib/confirm';
import { colors, inr, pnlColor, signedInr, timeIST, tok } from '../../lib/format';
import type { Order } from '../../lib/portfolio';
import { usePortfolio } from '../../lib/PortfolioContext';

const STATUS_COLOR: Record<Order['status'], string> = { OPEN: colors.accent, COMPLETE: colors.profit, REJECTED: colors.loss, CANCELLED: colors.muted };

export default function Orders() {
  const { state, cancel } = usePortfolio();
  const [busy, setBusy] = useState<string | null>(null);
  const open = state.orders.filter((o) => o.status === 'OPEN');
  const done = state.orders.filter((o) => o.status !== 'OPEN');
  const tradeFor = (id: string) => state.trades.find((t) => t.orderId === id);

  const confirmCancel = (o: Order) =>
    confirm('Cancel order?', `${o.side} ${o.qty} ${o.symbol} at ${inr(o.limitPrice ?? 0)}`, 'Cancel order', async () => {
      setBusy(o.id);
      try { await cancel(o.id); } finally { setBusy(null); }
    });

  return (
    <SectionList
      style={{ backgroundColor: colors.bg }}
      sections={[
        { title: `Open orders (${open.length})`, data: open },
        { title: `Executed and past (${done.length})`, data: done },
      ]}
      keyExtractor={(o) => o.id}
      ItemSeparatorComponent={Divider}
      stickySectionHeadersEnabled={false}
      renderSectionHeader={({ section }) => <Text style={styles.section}>{section.title}</Text>}
      renderSectionFooter={({ section }) => (section.data.length === 0 ? <Text style={styles.empty}>{section.title.startsWith('Open') ? 'No open orders. Limit orders wait here until they fill.' : 'Your orders will show up here.'}</Text> : null)}
      renderItem={({ item: o }) => {
        const t = tradeFor(o.id);
        const buy = o.side === 'BUY';
        return (
          <Pressable style={styles.row} onPress={o.status === 'OPEN' ? () => confirmCancel(o) : undefined} disabled={busy === o.id}>
            <View style={{ flex: 1, gap: 4 }}>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <Text style={[styles.tag, { color: buy ? colors.accent : colors.sell, backgroundColor: buy ? '#EEF3FF' : '#FEECEE' }]}>{o.side}</Text>
                <Text style={styles.muted}>{o.status === 'COMPLETE' ? o.qty : 0} / {o.qty}</Text>
              </View>
              <Text style={styles.sym}>{o.symbol}</Text>
              <Text style={styles.muted}>{o.type === 'MARKET' ? 'Market' : `Limit ${inr(o.limitPrice ?? 0)}`} · {timeIST(o.createdAt)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Text style={[styles.status, { color: STATUS_COLOR[o.status] }]}>{o.status}</Text>
              {o.fillPrice ? <Text style={styles.sym}>Avg. {inr(o.fillPrice)}</Text> : null}
              {t?.realizedPnl !== undefined ? <Text style={{ color: pnlColor(t.realizedPnl), fontWeight: '600' }}>{signedInr(t.realizedPnl)}</Text> : null}
              {t ? <Text style={styles.muted}>Charges {tok(t.charges)}</Text> : null}
              {o.status === 'OPEN' ? <Text style={[styles.muted, { color: colors.accent }]}>{busy === o.id ? 'Cancelling…' : 'Tap to cancel'}</Text> : null}
            </View>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  section: { color: colors.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8, backgroundColor: colors.bg },
  empty: { color: colors.muted, paddingHorizontal: 16, paddingBottom: 8 },
  row: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12 },
  tag: { fontSize: 11, fontWeight: '700', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3, overflow: 'hidden' },
  sym: { color: colors.text, fontWeight: '600', fontSize: 15 },
  muted: { color: colors.muted, fontSize: 12 },
  status: { fontSize: 11, fontWeight: '700' },
});
