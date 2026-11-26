import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addTokens, createPortfolio, placeOrder, summarize } from './portfolio.ts';

test('buy then sell at a higher price books a profit', () => {
  let s = createPortfolio(100_000);
  let r = placeOrder(s, { symbol: 'INFY', side: 'BUY', qty: 10, price: 1500 });
  assert.ok(r.ok);
  s = r.state;
  assert.equal(s.cash, 85_000);
  r = placeOrder(s, { symbol: 'INFY', side: 'SELL', qty: 10, price: 1600 });
  assert.ok(r.ok);
  assert.equal(r.trade.realizedPnl, 1000);
  assert.equal(r.state.cash, 101_000);
  assert.equal(r.state.positions.INFY, undefined);
  const sum = summarize(r.state, {});
  assert.equal(sum.realizedPnl, 1000);
  assert.equal(sum.winRate, 1);
  assert.equal(sum.totalPnl, 1000);
});

test('averages the buy price across multiple buys', () => {
  let s = createPortfolio(100_000);
  s = (placeOrder(s, { symbol: 'TCS', side: 'BUY', qty: 10, price: 100 }) as any).state;
  s = (placeOrder(s, { symbol: 'TCS', side: 'BUY', qty: 10, price: 200 }) as any).state;
  assert.equal(s.positions.TCS.avgPrice, 150);
  const r = placeOrder(s, { symbol: 'TCS', side: 'SELL', qty: 5, price: 120 });
  assert.ok(r.ok);
  assert.equal(r.trade.realizedPnl, -150);
  assert.equal(r.state.positions.TCS.qty, 15);
});

test('unrealized P&L uses the latest price', () => {
  let s = createPortfolio(100_000);
  s = (placeOrder(s, { symbol: 'SBIN', side: 'BUY', qty: 100, price: 800 }) as any).state;
  const sum = summarize(s, { SBIN: 780 });
  assert.equal(sum.unrealizedPnl, -2000);
  assert.equal(sum.equity, 98_000);
});

test('rejects orders it cannot fill', () => {
  const s = createPortfolio(1_000);
  assert.equal(placeOrder(s, { symbol: 'X', side: 'BUY', qty: 10, price: 200 }).ok, false);
  assert.equal(placeOrder(s, { symbol: 'X', side: 'SELL', qty: 1, price: 200 }).ok, false);
  assert.equal(placeOrder(s, { symbol: 'X', side: 'BUY', qty: 0, price: 200 }).ok, false);
});

test('adding tokens raises the balance but is not counted as profit', () => {
  let s = createPortfolio(100_000);
  const r = addTokens(s, 50_000);
  assert.ok(r.ok);
  s = r.state;
  assert.equal(s.cash, 150_000);
  let sum = summarize(s, {});
  assert.equal(sum.funded, 150_000);
  assert.equal(sum.totalPnl, 0);
  s = (placeOrder(s, { symbol: 'ITC', side: 'BUY', qty: 100, price: 400 }) as any).state;
  s = (placeOrder(s, { symbol: 'ITC', side: 'SELL', qty: 100, price: 390 }) as any).state;
  sum = summarize(s, {});
  assert.equal(s.cash, 149_000); // the loss came out of the token balance
  assert.equal(sum.totalPnl, -1000);
  assert.equal(addTokens(s, 0).ok, false);
  assert.equal(addTokens(s, 5_000_000).ok, false);
});
