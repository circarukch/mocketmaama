// Supabase Edge Function: chart candles for the app, from the server side.
// Browsers can't call the price feed directly (CORS), and a licensed feed's
// keys must never ship in the app, so charts load through here.
//
// PROTOTYPE FEED: Yahoo Finance (unofficial, ~15 min delayed, personal use
// only). Swap fetchCandles() for a licensed vendor before a public launch.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
};
const RANGE: Record<string, { interval: string; range: string }> = {
  '5m': { interval: '5m', range: '5d' },
  '1h': { interval: '60m', range: '1mo' },
  '1d': { interval: '1d', range: '1y' },
};

async function fetchCandles(symbol: string, tf: string) {
  const { interval, range } = RANGE[tf];
  const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol + '.NS')}?interval=${interval}&range=${range}`);
  if (!res.ok) throw new Error(`feed returned ${res.status}`);
  const r = (await res.json())?.chart?.result?.[0];
  const ts: number[] = r?.timestamp ?? [];
  const q = r?.indicators?.quote?.[0];
  const out = [];
  for (let i = 0; i < ts.length; i++) {
    const [o, h, l, c] = [q.open[i], q.high[i], q.low[i], q.close[i]];
    if ([o, h, l, c].some((v) => v == null)) continue;
    out.push({ time: ts[i], open: o, high: h, low: l, close: c, volume: q.volume?.[i] ?? undefined });
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const url = new URL(req.url);
  const symbol = (url.searchParams.get('symbol') ?? '').toUpperCase();
  const tf = url.searchParams.get('tf') ?? '1d';
  if (!/^[A-Z0-9&-]{1,20}$/.test(symbol) || !RANGE[tf]) return new Response('bad request', { status: 400, headers: CORS });
  try {
    const candles = await fetchCandles(symbol, tf);
    return Response.json({ candles, source: 'Delayed ~15 min' }, { headers: { ...CORS, 'Cache-Control': 'public, max-age=30' } });
  } catch (e) {
    return new Response(String(e), { status: 502, headers: CORS });
  }
});
