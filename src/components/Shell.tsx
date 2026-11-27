import { router, usePathname } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, tok } from '../lib/format';
import { usePortfolio } from '../lib/PortfolioContext';
import { useWide } from '../lib/useLayout';
import { Wordmark } from './ui';
import { WatchlistPanel } from './WatchlistPanel';

const NAV = [
  { href: '/', label: 'Dashboard' },
  { href: '/orders', label: 'Orders' },
  { href: '/portfolio', label: 'Portfolio' },
  { href: '/account', label: 'Account' },
] as const;

/**
 * Wide screens (desktop, tablets in landscape, unfolded foldables) get a
 * Kite-web style layout: top bar, watchlist on the left, page on the right.
 * Narrow screens get the normal phone layout with bottom tabs.
 */
export function Shell({ children }: { children: React.ReactNode }) {
  const wide = useWide();
  const path = usePathname();
  const { state } = usePortfolio();
  if (!wide) return <>{children}</>;

  return (
    <View style={styles.root}>
      <View style={styles.top}>
        <Pressable onPress={() => router.navigate('/')}><Wordmark size={20} /></Pressable>
        <View style={styles.nav}>
          {NAV.map((n) => {
            const on = n.href === '/' ? path === '/' : path.startsWith(n.href);
            return (
              <Pressable key={n.href} onPress={() => router.navigate(n.href)} style={styles.navItem}>
                <Text style={[styles.navText, on && styles.navOn]}>{n.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.tokens}>{tok(state.tokens, 0)} tokens</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.side}><WatchlistPanel /></View>
        <View style={styles.main}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  top: { height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, gap: 32, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  nav: { flexDirection: 'row', gap: 8, flex: 1 },
  navItem: { paddingHorizontal: 12, paddingVertical: 8 },
  navText: { color: colors.muted, fontWeight: '600' },
  navOn: { color: colors.brand },
  tokens: { color: colors.text, fontWeight: '600' },
  body: { flex: 1, flexDirection: 'row' },
  side: { width: 360, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: colors.border },
  main: { flex: 1, minWidth: 0 },
});
