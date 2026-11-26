import { findInstrument } from './symbols';
import type { Candle, MarketDataProvider, Timeframe } from './types';

const STEP_SECONDS: Record<Timeframe, number> = { '5m': 300, '1h': 3600, '1d': 86400 };
const VOL: Record<Timeframe, number> = { '5m': 0.0025, '1h': 0.006, '1d': 0.016 };

// Small deterministic PRNG so each symbol's history is stable between renders.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);

export function simulateCandles(symbol: string, timeframe: Timeframe, count = 300, nowSec = Math.floor(Date.now() / 1000)): Candle[] {
  const step = STEP_SECONDS[timeframe];
  const vol = VOL[timeframe];
  const end = Math.floor(nowSec / step) * step;
  // Seed by symbol + the current bucket so the last candle moves over time.
  const rand = mulberry32(hash(symbol + timeframe));
  let price = (findInstrument(symbol)?.refPrice ?? 1000) * (0.85 + rand() * 0.3);
  const out: Candle[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const open = price;
    const drift = (rand() - 0.49) * vol * 2;
    const close = Math.max(1, open * (1 + drift));
    const high = Math.max(open, close) * (1 + rand() * vol * 0.6);
    const low = Math.min(open, close) * (1 - rand() * vol * 0.6);
    out.push({ time: end - i * step, open: r2(open), high: r2(high), low: r2(low), close: r2(close), volume: Math.round(1e5 + rand() * 1e6) });
    price = close;
  }
  // Live-ish wiggle on the last candle, so practice trades see price movement.
  const last = out[out.length - 1];
  const wiggle = 1 + Math.sin(nowSec / 7 + hash(symbol)) * vol * 0.3;
  last.close = r2(last.close * wiggle);
  last.high = Math.max(last.high, last.close);
  last.low = Math.min(last.low, last.close);
  return out;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export const simulatedProvider: MarketDataProvider = {
  name: 'Simulated prices',
  simulated: true,
  async getCandles(symbol, timeframe) {
    return simulateCandles(symbol, timeframe);
  },
};
