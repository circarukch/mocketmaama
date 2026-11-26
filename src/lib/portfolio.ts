// Pure paper-trading engine. No React, no I/O, so it is easy to unit test.
// All money in the app is practice TOKENS (1 token = ₹1 of practice value).

export type Side = 'BUY' | 'SELL';

export interface Trade {
  id: string;
  symbol: string;
  side: Side;
  qty: number;
  price: number;
  time: number; // unix ms
  /** For SELL trades: profit or loss locked in versus the average buy price. */
  realizedPnl?: number;
  note?: string;
}

export interface Position {
  symbol: string;
  qty: number;
  avgPrice: number;
}

export interface TokenTopUp {
  id: string;
  amount: number;
  time: number;
}

export interface PortfolioState {
  version: 2;
  startingCash: number; // welcome tokens
  cash: number; // token balance available to trade
  topUps: TokenTopUp[]; // newest first
  positions: Record<string, Position>;
  trades: Trade[]; // newest first
}

export interface OrderRequest {
  symbol: string;
  side: Side;
  qty: number;
  price: number;
  time?: number;
  note?: string;
}

export type OrderResult =
  | { ok: true; state: PortfolioState; trade: Trade }
  | { ok: false; error: string };

export const DEFAULT_STARTING_CASH = 100_000; // welcome tokens for a new account
export const MAX_TOP_UP = 1_000_000;

export function createPortfolio(startingCash = DEFAULT_STARTING_CASH): PortfolioState {
  return { version: 2, startingCash, cash: startingCash, topUps: [], positions: {}, trades: [] };
}

/** Tokens the user has put in: welcome tokens plus every top-up. P&L is measured against this. */
export const totalFunded = (s: PortfolioState) => s.startingCash + s.topUps.reduce((t, u) => t + u.amount, 0);

export function addTokens(state: PortfolioState, amount: number, time = Date.now()): { ok: true; state: PortfolioState } | { ok: false; error: string } {
  const amt = Math.floor(amount);
  if (!Number.isFinite(amt) || amt <= 0) return { ok: false, error: 'Enter how many tokens to add.' };
  if (amt > MAX_TOP_UP) return { ok: false, error: `You can add up to ${MAX_TOP_UP.toLocaleString('en-IN')} tokens at a time.` };
  const topUp: TokenTopUp = { id: newId(time), amount: amt, time };
  return { ok: true, state: { ...state, cash: round2(state.cash + amt), topUps: [topUp, ...state.topUps] } };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

let idCounter = 0;
const newId = (time: number) => `${time.toString(36)}-${(idCounter++).toString(36)}`;

export function placeOrder(state: PortfolioState, order: OrderRequest): OrderResult {
  const { symbol, side, price } = order;
  const qty = Math.floor(order.qty);
  const time = order.time ?? Date.now();

  if (!symbol) return { ok: false, error: 'Pick a stock first.' };
  if (!Number.isFinite(qty) || qty <= 0) return { ok: false, error: 'Quantity must be at least 1.' };
  if (!Number.isFinite(price) || price <= 0) return { ok: false, error: 'No live price yet. Try again in a moment.' };

  const existing = state.positions[symbol];
  const value = round2(qty * price);
  const positions = { ...state.positions };
  let cash = state.cash;
  let realizedPnl: number | undefined;

  if (side === 'BUY') {
    if (value > cash + 1e-9) {
      return { ok: false, error: `Not enough tokens. This order needs ${value.toLocaleString('en-IN')} but you have ${round2(cash).toLocaleString('en-IN')}. Add tokens in Wallet.` };
    }
    const prevQty = existing?.qty ?? 0;
    const prevCost = prevQty * (existing?.avgPrice ?? 0);
    const newQty = prevQty + qty;
    positions[symbol] = { symbol, qty: newQty, avgPrice: (prevCost + value) / newQty };
    cash = round2(cash - value);
  } else {
    const held = existing?.qty ?? 0;
    if (held < qty) {
      return { ok: false, error: held === 0 ? `You don't hold any ${symbol}.` : `You only hold ${held} ${symbol}.` };
    }
    realizedPnl = round2((price - existing!.avgPrice) * qty);
    const remaining = held - qty;
    if (remaining === 0) delete positions[symbol];
    else positions[symbol] = { ...existing!, qty: remaining };
    cash = round2(cash + value);
  }

  const trade: Trade = { id: newId(time), symbol, side, qty, price, time, realizedPnl, note: order.note };
  return { ok: true, trade, state: { ...state, cash, positions, trades: [trade, ...state.trades] } };
}

export interface PositionView extends Position {
  lastPrice: number;
  marketValue: number;
  unrealizedPnl: number;
  unrealizedPct: number;
}

export interface PortfolioSummary {
  cash: number; // token balance
  funded: number; // welcome tokens + top-ups
  invested: number; // cost basis of open positions
  marketValue: number; // current value of open positions
  equity: number; // cash + marketValue
  unrealizedPnl: number;
  realizedPnl: number;
  totalPnl: number; // equity - funded
  totalPct: number;
  closedTrades: number;
  winningTrades: number;
  winRate: number; // 0..1, over SELL trades
  bestTrade?: Trade;
  worstTrade?: Trade;
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
  const unrealizedPnl = marketValue - invested;
  const sells = state.trades.filter((t) => t.side === 'SELL' && t.realizedPnl !== undefined);
  const realizedPnl = sells.reduce((s, t) => s + (t.realizedPnl ?? 0), 0);
  const winningTrades = sells.filter((t) => (t.realizedPnl ?? 0) > 0).length;
  const sorted = [...sells].sort((a, b) => (b.realizedPnl ?? 0) - (a.realizedPnl ?? 0));
  const equity = state.cash + marketValue;
  const funded = totalFunded(state);

  return {
    cash: state.cash,
    funded,
    invested,
    marketValue,
    equity,
    unrealizedPnl,
    realizedPnl,
    totalPnl: equity - funded,
    totalPct: funded ? (equity / funded - 1) * 100 : 0,
    closedTrades: sells.length,
    winningTrades,
    winRate: sells.length ? winningTrades / sells.length : 0,
    bestTrade: sorted[0],
    worstTrade: sorted.length ? sorted[sorted.length - 1] : undefined,
    positions: positions.sort((a, b) => b.marketValue - a.marketValue),
  };
}
