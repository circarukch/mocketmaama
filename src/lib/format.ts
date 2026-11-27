export const inr = (n: number, digits = 2) =>
  '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const signedInr = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '') + inr(Math.abs(n));
export const pct = (n: number) => (n > 0 ? '+' : '') + n.toFixed(2) + '%';

/** Token amounts. 1 token buys ₹1 of stock; tokens are virtual and free. */
export const tok = (n: number, digits = 2) => n.toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits });
export const signedTok = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '') + tok(Math.abs(n));

/** 1,00,000 → "1 lakh", 1,00,00,000 → "1 crore" */
export const lakhCrore = (n: number) =>
  n >= 1e7 ? `${n / 1e7} crore` : n >= 1e5 ? `${n / 1e5} lakh` : n.toLocaleString('en-IN');

// Light, Kite-like palette with TradingView chart colours (matches the approved demo).
export const colors = {
  bg: '#FFFFFF',
  card: '#FFFFFF',
  surface: '#F6F8FD',
  border: '#E0E3EB',
  text: '#131722',
  muted: '#787B86',
  profit: '#089981',
  loss: '#F23645',
  accent: '#2962FF', // primary actions, BUY
  sell: '#F23645',
  brand: '#FF5A1F', // Mocket Maama wordmark
  warnBg: '#FFF4E5',
  warnText: '#8A4B00',
};

export const pnlColor = (n: number) => (n > 0 ? colors.profit : n < 0 ? colors.loss : colors.muted);

export const timeIST = (ms: number) =>
  new Date(ms).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
