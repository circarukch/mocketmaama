import type { Candle } from '../lib/data';
import { colors } from '../lib/format';
import type { Trade } from '../lib/portfolio';

/** Buy/sell arrows for the chart, each placed on the candle the trade happened in. */
export function tradeMarkers(candles: Candle[], trades: Trade[]) {
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
    .flatMap((t) => {
      const time = snap(Math.floor(t.time / 1000));
      if (time === undefined) return [];
      const buy = t.side === 'BUY';
      return [{
        time,
        position: buy ? ('belowBar' as const) : ('aboveBar' as const),
        color: buy ? colors.profit : colors.loss,
        shape: buy ? ('arrowUp' as const) : ('arrowDown' as const),
        text: `${buy ? 'B' : 'S'} ${t.qty}`,
      }];
    })
    .sort((a, b) => a.time - b.time);
}
