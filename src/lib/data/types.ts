export interface Candle {
  time: number; // unix seconds (UTC)
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export type Timeframe = '5m' | '1h' | '1d';

export interface CandleResult {
  candles: Candle[];
  source: string;
  /** true when this is simulated data, not real market prices */
  simulated: boolean;
}

/**
 * Anything that can supply OHLC candles. Swap in a licensed NSE/BSE feed
 * (a broker API or a market data vendor) by implementing this interface.
 */
export interface MarketDataProvider {
  name: string;
  simulated: boolean;
  getCandles(symbol: string, timeframe: Timeframe): Promise<Candle[]>;
}
