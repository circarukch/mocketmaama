import { useCallback, useEffect, useRef, useState } from 'react';
import { CandleResult, getCandles, Timeframe } from './data';
import { usePortfolio } from './PortfolioContext';

/** Loads candles for a symbol and refreshes them every `refreshMs`. */
export function useCandles(symbol: string, timeframe: Timeframe, refreshMs = 30_000) {
  const { setPrice } = usePortfolio();
  const [data, setData] = useState<CandleResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const alive = useRef(true);

  const load = useCallback(async () => {
    try {
      const r = await getCandles(symbol, timeframe);
      if (!alive.current) return;
      setData(r);
      setError(null);
      const last = r.candles[r.candles.length - 1];
      if (last) setPrice(symbol, last.close);
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [symbol, timeframe, setPrice]);

  useEffect(() => {
    alive.current = true;
    setLoading(true);
    load();
    const id = setInterval(load, refreshMs);
    return () => {
      alive.current = false;
      clearInterval(id);
    };
  }, [load, refreshMs]);

  return { data, error, loading, reload: load };
}
