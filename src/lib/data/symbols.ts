export interface Instrument {
  symbol: string; // NSE trading symbol
  name: string;
  /** rough reference price, only used to seed simulated data */
  refPrice: number;
}

// A starter watchlist of large NSE stocks.
export const WATCHLIST: Instrument[] = [
  { symbol: 'RELIANCE', name: 'Reliance Industries', refPrice: 1500 },
  { symbol: 'TCS', name: 'Tata Consultancy Services', refPrice: 3100 },
  { symbol: 'HDFCBANK', name: 'HDFC Bank', refPrice: 1000 },
  { symbol: 'INFY', name: 'Infosys', refPrice: 1550 },
  { symbol: 'ICICIBANK', name: 'ICICI Bank', refPrice: 1400 },
  { symbol: 'SBIN', name: 'State Bank of India', refPrice: 950 },
  { symbol: 'BHARTIARTL', name: 'Bharti Airtel', refPrice: 2000 },
  { symbol: 'ITC', name: 'ITC', refPrice: 410 },
  { symbol: 'LT', name: 'Larsen & Toubro', refPrice: 3900 },
  { symbol: 'HINDUNILVR', name: 'Hindustan Unilever', refPrice: 2450 },
  { symbol: 'AXISBANK', name: 'Axis Bank', refPrice: 1250 },
  { symbol: 'MARUTI', name: 'Maruti Suzuki', refPrice: 16000 },
];

export const findInstrument = (symbol: string) => WATCHLIST.find((i) => i.symbol === symbol);
