import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as cloud from './cloud';
import {
  cancelOrder as cancelLocal, claimDaily as claimLocal, createPortfolio, matchOpenOrders, migrate,
  OrderRequest, OrderResult, placeOrder as placeLocal, PortfolioState,
} from './portfolio';
import { cloudEnabled, supabase } from './supabase';

const STORAGE_KEY = 'mocket-maama/portfolio/v1';
const ONBOARDED_KEY = 'mocket-maama/onboarded';

export type Mode = 'offline' | 'cloud';

interface AccountContextValue {
  mode: Mode;
  /** cloud mode only: the signed-in session, null when signed out */
  session: Session | null;
  state: PortfolioState;
  ready: boolean;
  onboarded: boolean;
  /** latest price seen per symbol, used for live P&L */
  prices: Record<string, number>;
  setPrice: (symbol: string, price: number) => void;
  order: (req: OrderRequest) => Promise<OrderResult>;
  cancel: (orderId: string) => Promise<void>;
  /** start over with 1 lakh, 10 lakh or 1 crore tokens */
  reset: (startingTokens: number) => Promise<void>;
  claimDaily: () => Promise<void>;
  completeOnboarding: (startingTokens: number) => Promise<void>;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AccountContextValue | null>(null);

export function PortfolioProvider({ children }: { children: React.ReactNode }) {
  const mode: Mode = cloudEnabled ? 'cloud' : 'offline';
  const [state, setState] = useState<PortfolioState>(() => createPortfolio());
  const [ready, setReady] = useState(false);
  const [onboarded, setOnboarded] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // ---- load
  useEffect(() => {
    AsyncStorage.getItem(ONBOARDED_KEY).then((v) => setOnboarded(v === 'yes')).catch(() => setOnboarded(false));
    if (mode === 'offline') {
      AsyncStorage.getItem(STORAGE_KEY)
        .then((raw) => {
          const saved = raw ? migrate(JSON.parse(raw)) : null;
          if (saved) {
            setState(saved);
            setOnboarded(true); // existing players skip the welcome screen
          }
        })
        .catch(() => {})
        .finally(() => setReady(true));
      return;
    }
    supabase!.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) setReady(true);
    });
    const { data: sub } = supabase!.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, [mode]);

  const refresh = useCallback(async () => {
    if (mode !== 'cloud' || !session) return;
    try {
      setState(await cloud.loadState());
    } finally {
      setReady(true);
    }
  }, [mode, session]);

  // cloud: load on sign-in and follow live changes
  useEffect(() => {
    if (mode !== 'cloud' || !session) return;
    refresh().catch(() => {});
    return cloud.subscribe(() => refresh().catch(() => {}));
  }, [mode, session, refresh]);

  // cloud: prices come from the server's quotes, the same prices orders fill at
  useEffect(() => {
    if (mode !== 'cloud' || !session) return;
    let alive = true;
    const load = () =>
      cloud.loadQuotes().then((qs) => {
        if (!alive || !qs.length) return;
        setPrices((p) => {
          const next = { ...p };
          for (const q of qs) next[q.symbol] = q.ltp;
          return next;
        });
      }).catch(() => {});
    load();
    const id = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [mode, session]);

  // offline: persist
  useEffect(() => {
    if (mode === 'offline' && ready) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
  }, [mode, state, ready]);

  const setPrice = useCallback(
    (symbol: string, price: number) => {
      if (mode === 'cloud') return; // cloud mode uses server quotes (see above)
      setPrices((p) => (p[symbol] === price ? p : { ...p, [symbol]: price }));
      // offline: open limit orders fill when the price reaches them (the server does this in cloud mode)
      if (mode === 'offline') {
        setState((s) => (s.orders.some((o) => o.status === 'OPEN' && o.symbol === symbol) ? matchOpenOrders(s, { [symbol]: price }).state : s));
      }
    },
    [mode]
  );

  const order = useCallback(
    async (req: OrderRequest): Promise<OrderResult> => {
      if (mode === 'offline') {
        const r = placeLocal(stateRef.current, req);
        if (r.ok) setState(r.state);
        return r;
      }
      try {
        await cloud.placeOrder({ symbol: req.symbol, side: req.side, qty: req.qty, type: req.type ?? 'MARKET', limitPrice: req.limitPrice });
        const next = await cloud.loadState();
        setState(next);
        const placed = next.orders[0];
        const trade = next.trades.find((t) => t.orderId === placed?.id);
        return { ok: true, state: next, order: placed, trade };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    },
    [mode]
  );

  const cancel = useCallback(
    async (orderId: string) => {
      if (mode === 'offline') return setState((s) => cancelLocal(s, orderId));
      await cloud.cancelOrder(orderId);
      await refresh();
    },
    [mode, refresh]
  );

  const reset = useCallback(
    async (startingTokens: number) => {
      if (mode === 'offline') return setState(createPortfolio(startingTokens));
      await cloud.resetAccount(startingTokens);
      await refresh();
    },
    [mode, refresh]
  );

  const claimDaily = useCallback(async () => {
    if (mode === 'offline') return setState((s) => claimLocal(s));
    await cloud.claimDaily();
    await refresh();
  }, [mode, refresh]);

  const completeOnboarding = useCallback(
    async (startingTokens: number) => {
      await reset(startingTokens);
      await AsyncStorage.setItem(ONBOARDED_KEY, 'yes').catch(() => {});
      setOnboarded(true);
    },
    [reset]
  );

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut();
    setState(createPortfolio());
  }, []);

  const value = useMemo(
    () => ({ mode, session, state, ready, onboarded, prices, setPrice, order, cancel, reset, claimDaily, completeOnboarding, refresh, signOut }),
    [mode, session, state, ready, onboarded, prices, setPrice, order, cancel, reset, claimDaily, completeOnboarding, refresh, signOut]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePortfolio() {
  const v = useContext(Ctx);
  if (!v) throw new Error('usePortfolio must be used inside PortfolioProvider');
  return v;
}
