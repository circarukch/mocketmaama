// Pure paper-trading engine. No React, no I/O, so it is easy to unit test.
//
// Money in Mocket Maama is virtual tokens: 1 token buys ₹1 of stock. Tokens are
// free, can never be bought, withdrawn or exchanged for anything.
//
// The server (supabase/migrations) applies the same rules in SQL. Keep the two
// in sync: fills, charges, limit-order matching and the daily claim.

import { computeCharges, type Side } from './charges.ts';

export type { Side } from './charges.ts';
export type OrderType = 'MARKET' | 'LIMIT';
export type OrderStatus = 'OPEN' | 'COMPLETE' | 'REJECTED' | 'CANCELLED';

/** An executed fill. Drawn as a marker on the chart and listed in the trade book. */
export interface Trade {
  id: string;
  orderId: string;
  symbol: string;
  side: Side;
  qty: number;
  price: number;
  time: number; // unix ms
  charges: number;
  /** For SELL trades: profit or loss versus the average buy price, before charges. */
  realizedPnl?: number;
}

export interface Order {
  id: string;
  symbol: string;
  side: Side;
  qty: number;
  type: OrderType;
  limitPrice?: number;
  status: OrderStatus;
  createdAt: number;
  /** tokens held back while a BUY limit order is open */
  blocked: number;
  filledAt?: number;
  fillPrice?: number;
  rejectReason?: string;
}

export interface Position {
  symbol: string;
  qty: number;
  avgPrice: number;
}

export interface PortfolioState {
  version: 2;
  startingTokens: number;
  /** tokens free to trade */
  tokens: number;
  positions: Record<string, Position>;
  orders: Order[]; // newest first
  trades: Trade[]; // newest first
  totalCharges: number;
  dailyClaimed: number; // tokens received from daily claims
  lastDailyClaim?: string; // YYYY-MM-DD in IST
}

export interface OrderRequest {
  symbol: string;
  side: Side;
  qty: number;
  type?: OrderType;
  limitPrice?: number;
  /** latest market price the user saw */
  ltp: number;
  time?: number;
}

export type OrderResult =
  | { ok: true; state: PortfolioState; order: Order; trade?: Trade }
  | { ok: false; error: string };

export const STARTING_BALANCES = [100_000, 1_000_000, 10_000_000] as const;
export const DEFAULT_STARTING_TOKENS = 1_000_000;
/** Daily free top-up: 1% of the starting balance. */
export const DAILY_CLAIM_RATE = 0.01;

export function createPortfolio(startingTokens: number = DEFAULT_STARTING_TOKENS): PortfolioState {
  return { version: 2, startingTokens, tokens: startingTokens, positions: {}, orders: [], trades: [], totalCharges: 0, dailyClaimed: 0 };
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const fmt = (n: number) => r2(n).toLocaleString('en-IN');

let idCounter = 0;
const newId = (time: number) => `${time.toString(36)}-${(idCounter++).toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;

/** Upgrades a v1 save (cash in rupees, trades only) to v2. */
export function migrate(saved: any): PortfolioState | null {
  if (saved?.version === 2) return saved as PortfolioState;
  if (saved?.version !== 1) return null;
  const trades: Trade[] = (saved.trades ?? []).map((t: any) => ({ ...t, orderId: t.id, charges: 0 }));
  const orders: Order[] = trades.map((t) => ({
    id: t.id, symbol: t.symbol, side: t.side, qty: t.qty, type: 'MARKET', status: 'COMPLETE',
    createdAt: t.time, filledAt: t.time, fillPrice: t.price, blocked: 0,
  }));
  return { version: 2, startingTokens: saved.startingCash, tokens: saved.cash, positions: saved.positions ?? {}, orders, trades, totalCharges: 0, dailyClaimed: 0 };
}

/** Quantity of a symbol already promised to open SELL orders. */
const reservedForSells = (state: PortfolioState, symbol: string, exceptId?: string) =>
  state.orders.filter((o) => o.status === 'OPEN' && o.side === 'SELL' && o.symbol === symbol && o.id !== exceptId).reduce((s, o) => s + o.qty, 0);

/** Tokens a BUY needs at `price`, charges included. */
export const buyCost = (qty: number, price: number) => {
  const value = r2(qty * price);
  return r2(value + computeCharges('BUY', value).total);
};

/** Applies a fill to the state. Assumes the order was validated. */
function fill(state: PortfolioState, order: Order, price: number, time: number): { state: PortfolioState; order: Order; trade: Trade } {
  const { symbol, side, qty } = order;
  const value = r2(qty * price);
  const charges = computeCharges(side, value).total;
  const positions = { ...state.positions };
  const existing = positions[symbol];
  let tokens = state.tokens + order.blocked; // release anything held back first
  let realizedPnl: number | undefined;

  if (side === 'BUY') {
    tokens = r2(tokens - value - charges);
    const prevQty = existing?.qty ?? 0;
    const newQty = prevQty + qty;
    positions[symbol] = { symbol, qty: newQty, avgPrice: r2((prevQty * (existing?.avgPrice ?? 0) + value) / newQty) };
  } else {
    realizedPnl = r2((price - existing!.avgPrice) * qty);
    const remaining = existing!.qty - qty;
    if (remaining === 0) delete positions[symbol];
    else positions[symbol] = { ...existing!, qty: remaining };
    tokens = r2(tokens + value - charges);
  }

  const done: Order = { ...order, status: 'COMPLETE', blocked: 0, filledAt: time, fillPrice: price };
  const trade: Trade = { id: newId(time), orderId: order.id, symbol, side, qty, price, time, charges, realizedPnl };
  const orders = state.orders.some((o) => o.id === order.id) ? state.orders.map((o) => (o.id === order.id ? done : o)) : [done, ...state.orders];
  return {
    order: done,
    trade,
    state: { ...state, tokens, positions, orders, trades: [trade, ...state.trades], totalCharges: r2(state.totalCharges + charges) },
  };
}

export function placeOrder(state: PortfolioState, req: OrderRequest): OrderResult {
  const { symbol, side, ltp } = req;
  const type = req.type ?? 'MARKET';
  const qty = Math.floor(req.qty);
  const time = req.time ?? Date.now();
  const limit = type === 'LIMIT' ? r2(req.limitPrice ?? NaN) : undefined;

  if (!symbol) return { ok: false, error: 'Pick a stock first.' };
  if (!Number.isFinite(qty) || qty <= 0) return { ok: false, error: 'Quantity must be at least 1.' };
  if (!Number.isFinite(ltp) || ltp <= 0) return { ok: false, error: 'No price yet. Try again in a moment.' };
  if (type === 'LIMIT' && !(limit! > 0)) return { ok: false, error: 'Enter a limit price above zero.' };

  // A limit order that is already marketable fills now, at the better market price.
  const fillsNow = type === 'MARKET' || (side === 'BUY' ? ltp <= limit! : ltp >= limit!);
  const order: Order = { id: newId(time), symbol, side, qty, type, limitPrice: limit, status: 'OPEN', createdAt: time, blocked: 0 };

  if (side === 'BUY') {
    const need = buyCost(qty, fillsNow ? ltp : limit!);
    if (need > state.tokens + 1e-9) {
      return { ok: false, error: `Not enough tokens. This order needs ${fmt(need)} but you have ${fmt(state.tokens)} free.` };
    }
    if (!fillsNow) {
      const open = { ...order, blocked: need };
      return { ok: true, order: open, state: { ...state, tokens: r2(state.tokens - need), orders: [open, ...state.orders] } };
    }
  } else {
    const held = state.positions[symbol]?.qty ?? 0;
    const free = held - reservedForSells(state, symbol);
    if (free < qty) {
      if (held === 0) return { ok: false, error: `You don't hold any ${symbol}. Short selling isn't available yet.` };
      return { ok: false, error: `You can sell up to ${free} ${symbol}${free < held ? ' (the rest is in open sell orders)' : ''}.` };
    }
    if (!fillsNow) return { ok: true, order, state: { ...state, orders: [order, ...state.orders] } };
  }

  return { ok: true, ...fill(state, order, ltp, time) };
}

/** Fills open limit orders whose price has been reached. Fills at the limit price. */
export function matchOpenOrders(state: PortfolioState, prices: Record<string, number | undefined>, time = Date.now()): { state: PortfolioState; filled: Trade[] } {
  let s = state;
  const filled: Trade[] = [];
  for (const o of [...state.orders].reverse()) {
    if (o.status !== 'OPEN' || o.limitPrice === undefined) continue;
    const ltp = prices[o.symbol];
    if (!ltp) continue;
    const crossed = o.side === 'BUY' ? ltp <= o.limitPrice : ltp >= o.limitPrice;
    if (!crossed) continue;
    if (o.side === 'SELL' && (s.positions[o.symbol]?.qty ?? 0) < o.qty) continue;
    const r = fill(s, o, o.limitPrice, time);
    s = r.state;
    filled.push(r.trade);
  }
  return { state: s, filled };
}

export function cancelOrder(state: PortfolioState, orderId: string): PortfolioState {
  const o = state.orders.find((x) => x.id === orderId);
  if (!o || o.status !== 'OPEN') return state;
  return {
    ...state,
    tokens: r2(state.tokens + o.blocked),
    orders: state.orders.map((x) => (x.id === orderId ? { ...x, status: 'CANCELLED', blocked: 0 } : x)),
  };
}

/** Calendar date in India, used for the once-a-day claim. */
export const istDate = (ms = Date.now()) => new Date(ms + 5.5 * 3600_000).toISOString().slice(0, 10);

export const dailyClaimAmount = (state: PortfolioState) => r2(state.startingTokens * DAILY_CLAIM_RATE);
export const canClaimDaily = (state: PortfolioState, now = Date.now()) => state.lastDailyClaim !== istDate(now);

export function claimDaily(state: PortfolioState, now = Date.now()): PortfolioState {
  if (!canClaimDaily(state, now)) return state;
  const amount = dailyClaimAmount(state);
  return { ...state, tokens: r2(state.tokens + amount), dailyClaimed: r2(state.dailyClaimed + amount), lastDailyClaim: istDate(now) };
}

export interface PositionView extends Position {
  lastPrice: number;
  marketValue: number;
  unrealizedPnl: number;
  unrealizedPct: number;
}

export interface PortfolioSummary {
  tokens: number; // free
  blocked: number; // held for open buy orders
  invested: number; // cost basis of open positions
  marketValue: number;
  equity: number; // tokens + blocked + marketValue
  unrealizedPnl: number;
  realizedPnl: number; // before charges
  charges: number;
  /** what trading itself earned: equity minus everything you were given */
  totalPnl: number;
  totalPct: number;
  closedTrades: number;
  winningTrades: number;
  winRate: number;
  bestTrade?: Trade;
  worstTrade?: Trade;
  openOrders: number;
  positions: PositionView[];
}

/** prices: latest known price per symbol. Falls back to avg price if unknown. */
export function summarize(state: PortfolioState, prices: Record<string, number | undefined>): PortfolioSummary {
  const positions: PositionView[] = Object.values(state.positions).map((p) => {
    const lastPrice = prices[p.symbol] ?? p.avgPrice;
    const marketValue = p.qty * lastPrice;
    const unrealizedPnl = (lastPrice - p.avgPrice) * p.qty;
    return { ...p, lastPrice, marketValue, unrealizedPnl, unrealizedPct: p.avgPrice ? (lastPrice / p.avgPrice - 1) * 100 : 0 };
  });

  const invested = positions.reduce((s, p) => s + p.qty * p.avgPrice, 0);
  const marketValue = positions.reduce((s, p) => s + p.marketValue, 0);
  const blocked = state.orders.reduce((s, o) => s + (o.status === 'OPEN' ? o.blocked : 0), 0);
  const sells = state.trades.filter((t) => t.side === 'SELL' && t.realizedPnl !== undefined);
  const realizedPnl = sells.reduce((s, t) => s + (t.realizedPnl ?? 0), 0);
  const winningTrades = sells.filter((t) => (t.realizedPnl ?? 0) > 0).length;
  const sorted = [...sells].sort((a, b) => (b.realizedPnl ?? 0) - (a.realizedPnl ?? 0));
  const equity = state.tokens + blocked + marketValue;
  const given = state.startingTokens + state.dailyClaimed;

  return {
    tokens: state.tokens,
    blocked,
    invested,
    marketValue,
    equity,
    unrealizedPnl: marketValue - invested,
    realizedPnl,
    charges: state.totalCharges,
    totalPnl: equity - given,
    totalPct: (equity / given - 1) * 100,
    closedTrades: sells.length,
    winningTrades,
    winRate: sells.length ? winningTrades / sells.length : 0,
    bestTrade: sorted[0],
    worstTrade: sorted.length ? sorted[sorted.length - 1] : undefined,
    openOrders: state.orders.filter((o) => o.status === 'OPEN').length,
    positions: positions.sort((a, b) => b.marketValue - a.marketValue),
  };
}
