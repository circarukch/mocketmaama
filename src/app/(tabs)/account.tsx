import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Banner, Button, Divider, Wordmark } from '../../components/ui';
import * as cloud from '../../lib/cloud';
import { confirm } from '../../lib/confirm';
import { colors, lakhCrore, pct, pnlColor, tok } from '../../lib/format';
import { canClaimDaily, dailyClaimAmount, STARTING_BALANCES, summarize } from '../../lib/portfolio';
import { usePortfolio } from '../../lib/PortfolioContext';

export default function Account() {
  const { state, prices, mode, session, claimDaily, reset, signOut } = usePortfolio();
  const s = summarize(state, prices);
  const [msg, setMsg] = useState<{ text: string; good: boolean } | null>(null);
  const [board, setBoard] = useState<cloud.LeaderRow[] | null>(null);
  const claimable = canClaimDaily(state);

  useEffect(() => {
    if (mode === 'cloud' && session) cloud.leaderboard().then(setBoard).catch(() => setBoard(null));
  }, [mode, session, state]);

  const claim = async () => {
    try {
      await claimDaily();
      setMsg({ text: `Added ${tok(dailyClaimAmount(state))} free tokens. Come back tomorrow for more.`, good: true });
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : String(e), good: false });
    }
  };

  const confirmReset = (amount: number) =>
    confirm(`Start over with ${lakhCrore(amount)} tokens?`, 'This clears your holdings, open orders and P&L.', 'Start over', () =>
      reset(amount).then(() => setMsg({ text: `Fresh start with ${lakhCrore(amount)} tokens.`, good: true }))
    );

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, gap: 16 }}>
      <View style={styles.card}>
        <Text style={styles.k}>Tokens available</Text>
        <Text style={styles.big}>{tok(s.tokens)}</Text>
        <View style={styles.split}><Text style={styles.k}>Held for open orders</Text><Text style={styles.v}>{tok(s.blocked)}</Text></View>
        <View style={styles.split}><Text style={styles.k}>Holdings value</Text><Text style={styles.v}>{tok(s.marketValue)}</Text></View>
        <View style={styles.split}><Text style={styles.k}>Account value</Text><Text style={styles.v}>{tok(s.equity)}</Text></View>
        <View style={styles.split}><Text style={styles.k}>Started with</Text><Text style={styles.v}>{lakhCrore(state.startingTokens)}{state.dailyClaimed ? ` + ${tok(state.dailyClaimed, 0)} claimed` : ''}</Text></View>
        <View style={styles.split}><Text style={styles.k}>Trading return</Text><Text style={[styles.v, { color: pnlColor(s.totalPct) }]}>{pct(s.totalPct)}</Text></View>
      </View>

      <View style={styles.card}>
        <Text style={styles.h2}>Daily free tokens</Text>
        <Text style={styles.k}>Claim {tok(dailyClaimAmount(state), 0)} tokens once a day. Claimed tokens don’t count as trading profit.</Text>
        <Button title={claimable ? 'Claim today’s tokens' : 'Claimed today. Back tomorrow'} onPress={claim} disabled={!claimable} />
        {msg ? <Text style={{ color: msg.good ? colors.profit : colors.loss, fontWeight: '600' }}>{msg.text}</Text> : null}
      </View>

      {board ? (
        <View style={styles.card}>
          <Text style={styles.h2}>Leaderboard</Text>
          <Text style={styles.k}>Ranked by trading return, so every starting size competes fairly.</Text>
          {board.slice(0, 10).map((r) => (
            <View key={`${r.rank}-${r.display_name}`} style={[styles.split, r.is_me && { backgroundColor: '#EEF3FF', borderRadius: 4 }]}>
              <Text style={styles.v}>#{r.rank}  {r.display_name}{r.is_me ? ' (you)' : ''}</Text>
              <Text style={[styles.v, { color: pnlColor(r.return_pct) }]}>{pct(Number(r.return_pct))}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.h2}>Start over</Text>
        <Text style={styles.k}>Pick a new starting balance. Your trades so far are cleared.</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {STARTING_BALANCES.map((b) => (
            <View key={b} style={{ flex: 1 }}><Button title={lakhCrore(b)} outline color={colors.accent} onPress={() => confirmReset(b)} /></View>
          ))}
        </View>
      </View>

      <Divider />
      <View style={{ gap: 6 }}>
        <Wordmark />
        <Text style={styles.k}>{mode === 'cloud' ? `Signed in as ${session?.user.email ?? ''}` : 'Offline practice mode. Everything stays on this phone.'}</Text>
        {mode === 'cloud' ? <Pressable onPress={signOut}><Text style={{ color: colors.loss, fontWeight: '600', paddingVertical: 8 }}>Sign out</Text></Pressable> : null}
      </View>
      <Banner text="Mocket Maama is a learning app. Tokens are virtual, free, and have no cash value. They can’t be bought, sold, withdrawn or exchanged. Prices are delayed about 15 minutes. Nothing here is investment advice." />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: 8, backgroundColor: colors.surface, gap: 8 },
  big: { color: colors.text, fontSize: 28, fontWeight: '800' },
  h2: { color: colors.text, fontSize: 16, fontWeight: '700' },
  split: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 2, paddingHorizontal: 2 },
  k: { color: colors.muted, fontSize: 13 },
  v: { color: colors.text, fontSize: 14, fontWeight: '600' },
});
