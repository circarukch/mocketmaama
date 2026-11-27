# Mocket Maama

A paper trading web app for Indian stocks that works on desktops, tablets, foldables and phones. Practise buying and selling NSE stocks with free virtual tokens, see your trades on TradingView charts, and learn what every trade really costs.

**Tokens are virtual.** 1 token buys ₹1 of stock. Tokens are free (sign-up grant plus a daily claim) and can never be bought, withdrawn, transferred or exchanged for anything of value. This keeps the app a social/learning game under India's Online Gaming Act 2025, not a money game.

## What's in v0.2

- **Responsive web app** (Expo + React Native Web, one codebase). Wide screens (900 px and up) get a Kite-web style layout: top bar, watchlist on the left, page on the right, order ticket as a dialog. Narrow screens get a phone layout with bottom tabs. The same code still builds iOS and Android apps if wanted later.
- **Welcome**: pick 1 lakh, 10 lakh or 1 crore starting tokens, confirm 18+.
- **Watchlist** with search, **stock page** with TradingView Lightweight Charts (5m / 1h / 1D) and your buys and sells drawn as arrows.
- **Order ticket** like Kite: blue Buy / red Sell, Market or Limit, quantity, order value, real NSE delivery charges (STT, exchange, SEBI, stamp duty, GST, DP), tokens required.
- **Orders**: open limit orders (tap to cancel) and executed orders with P&L and charges.
- **Portfolio**: holdings, holdings P&L, booked P&L, charges, net trading P&L, win rate, best and worst call.
- **Account**: tokens, daily free claim (1% of starting balance, once per IST day), leaderboard (cloud mode), start over.
- **Two modes**
  - *Offline practice mode* (no setup): everything stays in the browser or on the phone.
  - *Cloud mode* (Supabase): email sign-in, all orders run on the server, live updates, leaderboard.

## Run it

```bash
npm ci               # .npmrc sets legacy-peer-deps
npx expo start --web # or press w; scan the QR code for a phone
npm test             # trading engine tests
npm run typecheck && npm run lint
```

Build the website: `npx expo export --platform web` writes a static single-page app to `dist/`. Host it anywhere that serves static files with a fallback to `index.html`, for example EAS Hosting (`npx eas-cli@latest deploy`), Vercel, Netlify or Cloudflare Pages.

## Backend (cloud mode)

Everything lives in `supabase/`. The app's public settings are in `.env` (project URL and anon key; both are meant to be public, and row-level security protects the data).

| Path | What it does |
|---|---|
| `migrations/..._trading_core.sql` | Tables (profiles, wallets, token_ledger, instruments, quotes, orders, positions), row-level security, and the only functions the app may call: `place_order`, `cancel_order`, `reset_account`, `claim_daily_tokens`, `leaderboard`, `set_display_name`. Sign-up grants 10 lakh tokens. Users can read their own rows but can't write any table, so fills and balances can't be faked. |
| `migrations/..._api_grants.sql` | Read-only API access for the app (newer Supabase projects don't expose tables by default). |
| `migrations/..._quote_sync_cron.sql` | Price updates inside the database: pg_cron runs `sync_quotes()` every minute, which uses pg_net to fetch prices, writes `quotes` and fills open limit orders. No service keys needed. |
| `seed.sql` | The starter instruments. |
| `functions/candles` | Chart candles for the app. Browsers can't call the price feed directly (CORS), and a licensed feed's keys must stay on the server. Without it, charts fall back to simulated history (trading still uses real server prices). |
| `tests/run.sh` | Runs the migrations and ~40 SQL checks (orders, limits, RLS, ledger, claims, reset, quote sync) on a local Postgres. |

Set up a new project:

1. Create a Supabase project. Email sign-in is on by default; make sure the Magic Link email template includes `{{ .Token }}` so users get a 6-digit code.
2. Run the migrations then `seed.sql` (SQL Editor, or `npx supabase db push`).
3. Deploy `functions/candles` (Edge Functions → Deploy a new function → Via editor, or `npx supabase functions deploy candles`).
4. Put the project URL and anon key in `.env`.

The trading rules exist twice and must stay in sync: `src/lib/portfolio.ts` + `src/lib/charges.ts` (offline mode, ticket previews) and the SQL functions (cloud mode). Both test suites check the same charge figures.

## Market data

The prototype uses Yahoo Finance's chart endpoint (free, ~15 min delayed, unofficial, personal use only) and falls back to simulated prices, with a banner, when it can't load. On the web without cloud mode, prices are simulated because browsers block direct calls to Yahoo.

**Before a public launch, plug in a licensed delayed feed** (TrueData, Global Datafeeds or similar). Only `quote_url()` / `parse_quote()` in the quote-sync migration and `supabase/functions/candles` change; the app and database stay the same. NSE's display licence for 15-minute delayed data is about ₹1.2 lakh a year per segment versus about ₹23.45 lakh for real-time.

## Project layout

```
src/app/                    screens (Expo Router)
  (tabs)/index.tsx          Watchlist (phone) / Dashboard (wide)
  (tabs)/orders.tsx         Orders
  (tabs)/portfolio.tsx      Portfolio
  (tabs)/account.tsx        Account
  stock/[symbol].tsx        chart + Buy/Sell
  order/[symbol].tsx        order ticket
src/components/Shell.tsx    wide-screen layout (top bar + watchlist sidebar)
src/components/Gate.tsx     sign-in and welcome
src/components/TradingChart(.web).tsx   Lightweight Charts (WebView on phones, direct on web)
src/lib/portfolio.ts        pure trading engine (tested)
src/lib/charges.ts          NSE delivery charges (tested)
src/lib/cloud.ts            Supabase calls
src/lib/data/               market data providers
supabase/                   backend
```

## Next

- Licensed delayed feed, more instruments and search across NSE/BSE.
- F&O (option chain, lots, margin, expiry) and MCX gold and silver.
- Lessons with quizzes, daily prediction games, weekly contests.
