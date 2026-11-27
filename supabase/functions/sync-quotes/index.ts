// Supabase Edge Function: refreshes public.quotes and fills open limit orders.
// Schedule it every minute during market hours (see README, "Backend").
//
// PROTOTYPE FEED: Yahoo Finance's chart endpoint is free, ~15 min delayed and
// unofficial; its terms allow personal use only. Replace fetchQuote() with a
// licensed vendor (TrueData, Global Datafeeds, ...) before a public launch.
// Only this function changes; the app and database stay the same.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SOURCE = 'Yahoo Finance (delayed, prototype)';
const SUFFIX: Record<string, string> = { NSE: '.NS', BSE: '.BO' };

async function fetchQuote(symbol: string, exchange: string) {
  const ticker = symbol + (SUFFIX[exchange] ?? '.NS');
  const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=5d`);
  if (!res.ok) throw new Error(`${ticker}: HTTP ${res.status}`);
  const meta = (await res.json())?.chart?.result?.[0]?.meta;
  const ltp = Number(meta?.regularMarketPrice);
  if (!(ltp > 0)) throw new Error(`${ticker}: no price`);
  const prev = Number(meta?.chartPreviousClose ?? meta?.previousClose);
  return { symbol, ltp, prev_close: prev > 0 ? prev : null, source: SOURCE, delayed: true, updated_at: new Date().toISOString() };
}

Deno.serve(async (req) => {
  // Only the scheduler (or an admin) may run this: require the service role key.
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  if (req.headers.get('Authorization') !== `Bearer ${key}`) return new Response('forbidden', { status: 403 });

  const db = createClient(Deno.env.get('SUPABASE_URL')!, key, { auth: { persistSession: false } });
  const { data: instruments, error } = await db.from('instruments').select('symbol, exchange').eq('active', true);
  if (error) return new Response(error.message, { status: 500 });

  const results = await Promise.allSettled(instruments.map((i) => fetchQuote(i.symbol, i.exchange)));
  const rows = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
  const failed = results.flatMap((r) => (r.status === 'rejected' ? [String(r.reason)] : []));

  if (rows.length) {
    const up = await db.from('quotes').upsert(rows);
    if (up.error) return new Response(up.error.message, { status: 500 });
  }
  const matched = await db.rpc('match_open_orders');
  return Response.json({ updated: rows.length, failed, filled: matched.data ?? 0, matchError: matched.error?.message });
});
