import type { Candle, MarketDataProvider } from './types';

// Candles from our own backend (supabase/functions/candles). Used whenever
// cloud mode is configured, and required on the web, where browsers block
// direct calls to the price feed.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const backendProvider: MarketDataProvider | null =
  url && key
    ? {
        name: 'Delayed ~15 min',
        simulated: false,
        async getCandles(symbol, timeframe) {
          const res = await fetch(`${url}/functions/v1/candles?symbol=${encodeURIComponent(symbol)}&tf=${timeframe}`, {
            headers: { apikey: key, Authorization: `Bearer ${key}` },
          });
          if (!res.ok) throw new Error(`Price feed returned ${res.status}`);
          const json = (await res.json()) as { candles: Candle[] };
          return json.candles;
        },
      }
    : null;
