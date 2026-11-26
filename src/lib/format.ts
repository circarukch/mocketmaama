export const inr = (n: number, digits = 2) =>
  '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const signedInr = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '') + inr(Math.abs(n));
export const pct = (n: number) => (n > 0 ? '+' : '') + n.toFixed(2) + '%';

export const colors = {
  bg: '#0B1220',
  card: '#131C2E',
  border: '#22304A',
  text: '#E6EDF7',
  muted: '#8A9BB5',
  profit: '#16C784',
  loss: '#EA3943',
  accent: '#F5A623',
};

export const pnlColor = (n: number) => (n > 0 ? colors.profit : n < 0 ? colors.loss : colors.muted);

export const timeIST = (ms: number) =>
  new Date(ms).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
