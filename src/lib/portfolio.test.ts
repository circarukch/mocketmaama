import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeCharges } from './charges.ts';
import {
  buyCost, cancelOrder, canClaimDaily, claimDaily, createPortfolio, matchOpenOrders, migrate, placeOrder, summarize,
} from './portfolio.ts';

const ok = <T extends { ok: boolean }>(r: T) => {
  assert.ok(r.ok, (r as any).error);
  return r as Extract<T, { ok: true }>;
};

test('charges on a ₹1,00,000 delivery buy and sell', () => {
  const buy = computeCharges('BUY', 100_000);
  assert.equal(buy.stt, 100);
  assert.equal(buy.stamp, 15);
  assert.equal(buy.exchange, 2.97);
  assert.equal(buy.sebi, 0.1);
  assert.equal(buy.gst, 0.55); // 18% of (2.97 + 0.10)
  assert.equal(buy.total, 118.62);
  const sell = computeCharges('SELL', 100_000);
  assert.equal(sell.stamp, 0);
  assert.equal(sell.dp, 15.34);
  assert.equal(sell.total, 118.96);
});

test('market buy then sell books gross profit and deducts charges from tokens', () => {
  let s = createPortfolio(100_000);
  const b = ok(placeOrder(s, { symbol: 'INFY', side: 'BUY', qty: 10, ltp: 1500 }));
  s = b.state;
  const buyCharges = computeCharges('BUY', 15_000).total;
  assert.equal(s.tokens, Math.round((85_000 - buyCharges) * 100) / 100);
  assert.equal(s.positions.INFY.avgPrice, 1500);
  const sl = ok(placeOrder(s, { symbol: 'INFY', side: 'SELL', qty: 10, ltp: 1600 }));
  assert.equal(sl.trade?.realizedPnl, 1000);
  assert.equal(sl.state.positions.INFY, undefined);
  const sum = summarize(sl.state, {});
  assert.equal(sum.realizedPnl, 1000);
  assert.equal(sum.winRate, 1);
  const charges = buyCharges + computeCharges('SELL', 16_000).total;
  assert.ok(Math.abs(sum.totalPnl - (1000 - charges)) < 0.01);
  assert.ok(Math.abs(sum.charges - charges) < 0.01);
});

test('averages the buy price across buys', () => {
  let s = createPortfolio(100_000);
  s = ok(placeOrder(s, { symbol: 'TCS', side: 'BUY', qty: 10, ltp: 100 })).state;
  s = ok(placeOrder(s, { symbol: 'TCS', side: 'BUY', qty: 10, ltp: 200 })).state;
  assert.equal(s.positions.TCS.avgPrice, 150);
  const r = ok(placeOrder(s, { symbol: 'TCS', side: 'SELL', qty: 5, ltp: 120 }));
  assert.equal(r.trade?.realizedPnl, -150);
  assert.equal(r.state.positions.TCS.qty, 15);
});

test('rejects orders it cannot fill', () => {
  const s = createPortfolio(1_000);
  assert.equal(placeOrder(s, { symbol: 'X', side: 'BUY', qty: 10, ltp: 200 }).ok, false);
  assert.equal(placeOrder(s, { symbol: 'X', side: 'SELL', qty: 1, ltp: 200 }).ok, false);
  assert.equal(placeOrder(s, { symbol: 'X', side: 'BUY', qty: 0, ltp: 200 }).ok, false);
  assert.equal(placeOrder(s, { symbol: 'X', side: 'BUY', qty: 1, ltp: 200, type: 'LIMIT' }).ok, false);
});

test('buy limit below market waits, blocks tokens, and fills at the limit', () => {
  let s = createPortfolio(100_000);
  const r = ok(placeOrder(s, { symbol: 'SBIN', side: 'BUY', qty: 10, ltp: 800, type: 'LIMIT', limitPrice: 780 }));
  assert.equal(r.order.status, 'OPEN');
  assert.equal(r.trade, undefined);
  const need = buyCost(10, 780);
  assert.equal(r.state.tokens, 100_000 - need);
  assert.equal(summarize(r.state, {}).equity, 100_000);
  s = matchOpenOrders(r.state, { SBIN: 790 }).state; // not reached
  assert.equal(s.orders[0].status, 'OPEN');
  const m = matchOpenOrders(s, { SBIN: 779 });
  assert.equal(m.filled.length, 1);
  assert.equal(m.filled[0].price, 780);
  assert.equal(m.state.orders[0].status, 'COMPLETE');
  assert.equal(m.state.positions.SBIN.qty, 10);
  assert.equal(m.state.tokens, 100_000 - need);
});

test('marketable limit fills immediately at the better market price', () => {
  const r = ok(placeOrder(createPortfolio(100_000), { symbol: 'ITC', side: 'BUY', qty: 10, ltp: 400, type: 'LIMIT', limitPrice: 410 }));
  assert.equal(r.order.status, 'COMPLETE');
  assert.equal(r.trade?.price, 400);
});

test('cancelling an open buy returns the blocked tokens', () => {
  const r = ok(placeOrder(createPortfolio(100_000), { symbol: 'LT', side: 'BUY', qty: 1, ltp: 4000, type: 'LIMIT', limitPrice: 3900 }));
  const s = cancelOrder(r.state, r.order.id);
  assert.equal(s.tokens, 100_000);
  assert.equal(s.orders[0].status, 'CANCELLED');
});

test('open sell orders reserve shares', () => {
  let s = ok(placeOrder(createPortfolio(100_000), { symbol: 'ITC', side: 'BUY', qty: 10, ltp: 400 })).state;
  s = ok(placeOrder(s, { symbol: 'ITC', side: 'SELL', qty: 8, ltp: 400, type: 'LIMIT', limitPrice: 450 })).state;
  const r = placeOrder(s, { symbol: 'ITC', side: 'SELL', qty: 5, ltp: 400 });
  assert.equal(r.ok, false);
  assert.match((r as any).error, /up to 2/);
});

test('daily claim pays 1% of the starting balance once per IST day', () => {
  const t = Date.parse('2026-11-27T10:00:00Z');
  let s = claimDaily(createPortfolio(1_000_000), t);
  assert.equal(s.tokens, 1_010_000);
  assert.equal(canClaimDaily(s, t + 3600_000), false);
  s = claimDaily(s, t + 3600_000);
  assert.equal(s.tokens, 1_010_000);
  // 19:00 UTC is 00:30 IST the next day
  assert.equal(canClaimDaily(s, Date.parse('2026-11-27T19:00:00Z')), true);
  // claimed tokens are not counted as trading profit
  assert.equal(summarize(s, {}).totalPnl, 0);
});

test('migrates a v1 save', () => {
  const v1 = { version: 1, startingCash: 1_000_000, cash: 985_000, positions: { INFY: { symbol: 'INFY', qty: 10, avgPrice: 1500 } }, trades: [{ id: 'a', symbol: 'INFY', side: 'BUY', qty: 10, price: 1500, time: 1 }] };
  const s = migrate(v1)!;
  assert.equal(s.version, 2);
  assert.equal(s.tokens, 985_000);
  assert.equal(s.orders.length, 1);
  assert.equal(s.trades[0].charges, 0);
});
