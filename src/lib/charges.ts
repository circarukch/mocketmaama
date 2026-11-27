// Charges for an NSE equity delivery (CNC) trade, modelled on a zero-brokerage
// discount broker. Rates are close to real-world values so users learn what a
// trade really costs, but they are approximations, not a contract note.
//
// Keep in sync with public.compute_charges() in supabase/migrations.

export type Side = 'BUY' | 'SELL';

export const RATES = {
  brokerage: 0, // delivery trades: zero brokerage
  stt: 0.001, // 0.1% on buy and sell
  exchangeTxn: 0.0000297, // NSE transaction charge 0.00297%
  sebi: 0.000001, // ₹10 per crore
  stampBuy: 0.00015, // 0.015% on buy only
  gst: 0.18, // on brokerage + exchange + SEBI fees
  dpSell: 15.34, // depository charge per sell order
} as const;

export interface ChargeBreakdown {
  brokerage: number;
  stt: number;
  exchange: number;
  sebi: number;
  stamp: number;
  gst: number;
  dp: number;
  total: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function computeCharges(side: Side, value: number): ChargeBreakdown {
  const brokerage = r2(value * RATES.brokerage);
  const stt = r2(value * RATES.stt);
  const exchange = r2(value * RATES.exchangeTxn);
  const sebi = r2(value * RATES.sebi);
  const stamp = side === 'BUY' ? r2(value * RATES.stampBuy) : 0;
  const gst = r2((brokerage + exchange + sebi) * RATES.gst);
  const dp = side === 'SELL' && value > 0 ? RATES.dpSell : 0;
  const total = r2(brokerage + stt + exchange + sebi + stamp + gst + dp);
  return { brokerage, stt, exchange, sebi, stamp, gst, dp, total };
}
