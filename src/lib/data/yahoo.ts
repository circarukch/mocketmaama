import type { Candle, MarketDataProvider, Timeframe } from './types';

// Yahoo Finance's public chart endpoint. It is free and covers NSE (".NS")
// and BSE (".BO"), but it is UNOFFICIAL: no SLA, delayed ~15 min for NSE,
// and its terms only allow personal use. Fine for a prototype; replace with a
// licensed feed (see README) before publishing to the stores.
const RANGE: Record<Timeframe, { interval: string; range: string }> = {
  '5m': { interval: '5m', range: '5d' },
  '1h': { interval: '60m', range: '1mo' },
  '1d': { interval: '1d', range: '1y' },
};

export const EXCHANGE_SUFFIX = '.NS'; // use '.BO' for BSE

export const yahooProvider: MarketDataProvider = {
  name: 'Yahoo Finance (delayed)',
  simulated: false,
  async getCandles(symbol, timeframe) {
    const { interval, range } = RANGE[timeframe];
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol + EXCHANGE_SUFFIX)}?interval=${interval}&range=${range}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Price feed returned ${res.status}`);
    const json = await res.json();
    const r = json?.chart?.result?.[0];
    const ts: number[] | undefined = r?.timestamp;
    const q = r?.indicators?.quote?.[0];
    if (!ts || !q) throw new Error('Price feed returned no data');
    const out: Candle[] = [];
    for (let i = 0; i < ts.length; i++) {
      const o = q.open[i], h = q.high[i], l = q.low[i], c = q.close[i];
      if ([o, h, l, c].some((v) => v == null)) continue;
      out.push({ time: ts[i], open: o, high: h, low: l, close: c, volume: q.volume?.[i] ?? undefined });
    }
    if (!out.length) throw new Error('Price feed returned no candles');
    return out;
  },
};
