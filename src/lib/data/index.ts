import { simulatedProvider } from './simulated';
import type { CandleResult, MarketDataProvider, Timeframe } from './types';
import { yahooProvider } from './yahoo';

export * from './types';
export * from './symbols';

/**
 * Providers are tried in order. The simulated feed is always last, so the
 * app keeps working offline or if the real feed is down.
 * To use a licensed feed, add it to the front of this list.
 */
const PROVIDERS: MarketDataProvider[] = [yahooProvider, simulatedProvider];

export async function getCandles(symbol: string, timeframe: Timeframe): Promise<CandleResult> {
  let lastError: unknown;
  for (const p of PROVIDERS) {
    try {
      const candles = await p.getCandles(symbol, timeframe);
      if (candles.length) return { candles, source: p.name, simulated: p.simulated };
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError ?? new Error('No market data available');
}
