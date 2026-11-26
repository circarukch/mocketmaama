import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './auth/AuthContext';
import { addTokens as addTokensPure, createPortfolio, OrderRequest, OrderResult, placeOrder, PortfolioState } from './portfolio';

// Each signed-in user gets their own tokens and trades on this device.
const storageKey = (userId: string) => `mocket-maama/portfolio/v2/${userId}`;

interface PortfolioContextValue {
  state: PortfolioState;
  ready: boolean;
  /** latest price seen per symbol, used for live P&L */
  prices: Record<string, number>;
  setPrice: (symbol: string, price: number) => void;
  order: (req: OrderRequest) => OrderResult;
  addTokens: (amount: number) => { ok: true } | { ok: false; error: string };
  reset: (startingCash?: number) => void;
}

const Ctx = createContext<PortfolioContextValue | null>(null);

export function PortfolioProvider({ children }: { children: React.ReactNode }) {
  const userId = useAuth().session?.userId ?? null;
  const [loaded, setLoaded] = useState<{ userId: string | null; state: PortfolioState }>({ userId: null, state: createPortfolio() });
  const [prices, setPrices] = useState<Record<string, number>>({});
  const ready = loaded.userId === userId && userId !== null;
  const state = loaded.state;
  const setState = useCallback((s: PortfolioState) => setLoaded((l) => ({ ...l, state: s })), []);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    AsyncStorage.getItem(storageKey(userId))
      .then((raw) => {
        const saved = raw ? (JSON.parse(raw) as PortfolioState) : null;
        if (alive) setLoaded({ userId, state: saved?.version === 2 ? saved : createPortfolio() });
      })
      .catch(() => alive && setLoaded({ userId, state: createPortfolio() }));
    return () => {
      alive = false;
    };
  }, [userId]);

  useEffect(() => {
    if (ready && userId) AsyncStorage.setItem(storageKey(userId), JSON.stringify(state)).catch(() => {});
  }, [state, ready, userId]);

  const setPrice = useCallback((symbol: string, price: number) => {
    setPrices((p) => (p[symbol] === price ? p : { ...p, [symbol]: price }));
  }, []);

  const order = useCallback(
    (req: OrderRequest) => {
      const result = placeOrder(state, req);
      if (result.ok) setState(result.state);
      return result;
    },
    [state, setState]
  );

  const addTokens = useCallback(
    (amount: number) => {
      const r = addTokensPure(state, amount);
      if (!r.ok) return r;
      setState(r.state);
      return { ok: true as const };
    },
    [state, setState]
  );

  const reset = useCallback((startingCash?: number) => setState(createPortfolio(startingCash)), [setState]);

  const value = useMemo(
    () => ({ state, ready, prices, setPrice, order, addTokens, reset }),
    [state, ready, prices, setPrice, order, addTokens, reset]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePortfolio() {
  const v = useContext(Ctx);
  if (!v) throw new Error('usePortfolio must be used inside PortfolioProvider');
  return v;
}
