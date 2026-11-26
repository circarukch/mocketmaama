import { useEffect, useState } from 'react';
import { CandleResult, getCandles, Timeframe } from './data';
import { usePortfolio } from './PortfolioContext';

type Loaded = { key: string; data: CandleResult | null; error: string | null };

/** Loads candles for a symbol and refreshes them every `refreshMs`. */
export function useCandles(symbol: string, timeframe: Timeframe, refreshMs = 30_000) {
  const { setPrice } = usePortfolio();
  const key = `${symbol}|${timeframe}`;
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await getCandles(symbol, timeframe);
        if (!alive) return;
        setLoaded({ key, data: r, error: null });
        const last = r.candles[r.candles.length - 1];
        if (last) setPrice(symbol, last.close);
      } catch (e) {
        // keep showing the last good data if a refresh fails
        if (alive) setLoaded((prev) => ({ key, data: prev?.key === key ? prev.data : null, error: e instanceof Error ? e.message : String(e) }));
      }
    };
    load();
    const id = setInterval(load, refreshMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [key, symbol, timeframe, refreshMs, setPrice]);

  const current = loaded?.key === key ? loaded : null;
  return { data: current?.data ?? null, error: current?.error ?? null, loading: !current };
}
