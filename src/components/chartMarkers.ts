import type { Candle } from '../lib/data';
import { colors } from '../lib/format';
import type { Trade } from '../lib/portfolio';

export interface Marker { time: number; position: 'belowBar' | 'aboveBar'; color: string; shape: 'arrowUp' | 'arrowDown'; text: string }

/** Places each trade on the candle it happened in, as a buy or sell arrow. */
export function tradeMarkers(candles: Candle[], trades: Trade[]): Marker[] {
  const times = candles.map((c) => c.time);
  const snap = (sec: number) => {
    let lo = 0, hi = times.length - 1, ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (times[mid] <= sec) { ans = mid; lo = mid + 1; } else hi = mid - 1;
    }
    return ans >= 0 ? times[ans] : undefined;
  };
  return trades
    .flatMap((t): Marker[] => {
      const time = snap(Math.floor(t.time / 1000));
      if (time === undefined) return [];
      const buy = t.side === 'BUY';
      return [{ time, position: buy ? 'belowBar' : 'aboveBar', color: buy ? colors.accent : colors.sell, shape: buy ? 'arrowUp' : 'arrowDown', text: `${buy ? 'B' : 'S'} ${t.qty}` }];
    })
    .sort((a, b) => a.time - b.time);
}

export const chartOptions = {
  layout: { background: { color: colors.card }, textColor: colors.muted, attributionLogo: true },
  grid: { vertLines: { color: '#F0F3FA' }, horzLines: { color: '#F0F3FA' } },
  rightPriceScale: { borderColor: colors.border },
  timeScale: { borderColor: colors.border, timeVisible: true, secondsVisible: false },
};
export const candleOptions = {
  upColor: colors.profit, downColor: colors.loss, borderVisible: false, wickUpColor: colors.profit, wickDownColor: colors.loss,
};
