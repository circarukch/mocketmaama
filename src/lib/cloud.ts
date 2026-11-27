// Talks to the Supabase backend. All trading rules run on the server
// (supabase/migrations); this file only calls them and maps rows into the
// same PortfolioState shape the offline engine uses, so screens don't care
// which mode they are in.

import type { Order, PortfolioState, Position, Side, Trade } from './portfolio';
import { supabase } from './supabase';

const num = (v: unknown) => (v == null ? undefined : Number(v));
const ms = (v: unknown) => (v ? Date.parse(String(v)) : 0);

function db() {
  if (!supabase) throw new Error('Cloud mode is not configured.');
  return supabase;
}

/** Turns a Postgres exception into a sentence a user can act on. */
function friendly(message: string) {
  const m = message.replace(/^.*?ERROR:\s*/, '');
  return m.charAt(0).toUpperCase() + m.slice(1) + (m.endsWith('.') ? '' : '.');
}

async function call<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await db().rpc(fn, args);
  if (error) throw new Error(friendly(error.message));
  return data as T;
}

export async function loadState(): Promise<PortfolioState> {
  const c = db();
  const [w, p, o] = await Promise.all([
    c.from('wallets').select('*').single(),
    c.from('positions').select('*'),
    c.from('orders').select('*').order('created_at', { ascending: false }).limit(300),
  ]);
  if (w.error) throw new Error(friendly(w.error.message));
  if (p.error) throw new Error(friendly(p.error.message));
  if (o.error) throw new Error(friendly(o.error.message));

  const positions: Record<string, Position> = {};
  for (const r of p.data) positions[r.symbol] = { symbol: r.symbol, qty: r.qty, avgPrice: Number(r.avg_price) };

  const resetAt = ms(w.data.reset_at);
  const orders: Order[] = o.data
    .filter((r) => ms(r.created_at) >= resetAt)
    .map((r) => ({
      id: r.id, symbol: r.symbol, side: r.side as Side, qty: r.qty, type: r.order_type, limitPrice: num(r.limit_price),
      status: r.status, createdAt: ms(r.created_at), blocked: Number(r.blocked), filledAt: r.filled_at ? ms(r.filled_at) : undefined,
      fillPrice: num(r.fill_price), rejectReason: r.reject_reason ?? undefined,
    }));
  const trades: Trade[] = o.data
    .filter((r) => r.status === 'COMPLETE' && ms(r.created_at) >= resetAt)
    .map((r) => ({
      id: r.id, orderId: r.id, symbol: r.symbol, side: r.side as Side, qty: r.qty, price: Number(r.fill_price),
      time: ms(r.filled_at), charges: Number(r.charges), realizedPnl: num(r.realized_pnl),
    }));

  return {
    version: 2,
    startingTokens: Number(w.data.starting_tokens),
    tokens: Number(w.data.tokens),
    positions,
    orders,
    trades,
    totalCharges: Number(w.data.total_charges),
    dailyClaimed: Number(w.data.daily_claimed),
    lastDailyClaim: w.data.last_daily_claim ?? undefined,
  };
}

export const placeOrder = (a: { symbol: string; side: Side; qty: number; type: 'MARKET' | 'LIMIT'; limitPrice?: number }) =>
  call<{ id: string; status: string; fill_price: number | null; realized_pnl: number | null }>('place_order', {
    p_symbol: a.symbol, p_side: a.side, p_qty: a.qty, p_order_type: a.type, p_limit_price: a.type === 'LIMIT' ? a.limitPrice : null,
  });

export const cancelOrder = (id: string) => call('cancel_order', { p_order_id: id });
export const resetAccount = (startingTokens: number) => call('reset_account', { p_starting_tokens: startingTokens });
export const claimDaily = () => call('claim_daily_tokens');
export const setDisplayName = (name: string) => call('set_display_name', { p_name: name });

export interface LeaderRow { rank: number; display_name: string; return_pct: number; is_me: boolean }
export const leaderboard = () => call<LeaderRow[]>('leaderboard', { p_limit: 50 });

/** Server quotes, used as the fill price in cloud mode. */
export async function loadQuotes(): Promise<{ symbol: string; ltp: number; updated_at: string }[]> {
  const { data, error } = await db().from('quotes').select('symbol, ltp, updated_at');
  if (error) throw new Error(friendly(error.message));
  return data.map((r) => ({ ...r, ltp: Number(r.ltp) }));
}

/** Calls `onChange` whenever this user's orders, wallet or positions change. */
export function subscribe(onChange: () => void) {
  const ch = db()
    .channel('account')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'wallets' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'positions' }, onChange)
    .subscribe();
  return () => {
    db().removeChannel(ch);
  };
}
