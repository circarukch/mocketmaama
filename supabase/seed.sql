-- Starter instruments: large NSE stocks (matches src/lib/data/symbols.ts).
insert into public.instruments (symbol, exchange, name) values
  ('RELIANCE', 'NSE', 'Reliance Industries'),
  ('TCS', 'NSE', 'Tata Consultancy Services'),
  ('HDFCBANK', 'NSE', 'HDFC Bank'),
  ('INFY', 'NSE', 'Infosys'),
  ('ICICIBANK', 'NSE', 'ICICI Bank'),
  ('SBIN', 'NSE', 'State Bank of India'),
  ('BHARTIARTL', 'NSE', 'Bharti Airtel'),
  ('ITC', 'NSE', 'ITC'),
  ('LT', 'NSE', 'Larsen & Toubro'),
  ('HINDUNILVR', 'NSE', 'Hindustan Unilever'),
  ('AXISBANK', 'NSE', 'Axis Bank'),
  ('MARUTI', 'NSE', 'Maruti Suzuki')
on conflict (symbol) do nothing;
