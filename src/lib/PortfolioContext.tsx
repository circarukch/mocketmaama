import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createPortfolio, OrderRequest, OrderResult, placeOrder, PortfolioState } from './portfolio';

const STORAGE_KEY = 'mocket-maama/portfolio/v1';

interface PortfolioContextValue {
  state: PortfolioState;
  ready: boolean;
  /** latest price seen per symbol, used for live P&L */
  prices: Record<string, number>;
  setPrice: (symbol: string, price: number) => void;
  order: (req: OrderRequest) => OrderResult;
  reset: (startingCash?: number) => void;
}

const Ctx = createContext<PortfolioContextValue | null>(null);

export function PortfolioProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PortfolioState>(() => createPortfolio());
  const [ready, setReady] = useState(false);
  const [prices, setPrices] = useState<Record<string, number>>({});

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        const saved = JSON.parse(raw) as PortfolioState;
        if (saved?.version === 1) setState(saved);
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (ready) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
  }, [state, ready]);

  const setPrice = useCallback((symbol: string, price: number) => {
    setPrices((p) => (p[symbol] === price ? p : { ...p, [symbol]: price }));
  }, []);

  const order = useCallback(
    (req: OrderRequest) => {
      const result = placeOrder(state, req);
      if (result.ok) setState(result.state);
      return result;
    },
    [state]
  );

  const reset = useCallback((startingCash?: number) => setState(createPortfolio(startingCash)), []);

  const value = useMemo(() => ({ state, ready, prices, setPrice, order, reset }), [state, ready, prices, setPrice, order, reset]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePortfolio() {
  const v = useContext(Ctx);
  if (!v) throw new Error('usePortfolio must be used inside PortfolioProvider');
  return v;
}
