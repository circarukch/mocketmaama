# Mocket Maama

A paper trading app for iOS and Android. Log in with your mobile number, practise buying and selling NSE scrips with tokens, see your trades on TradingView charts, and find out whether each decision made a profit or a loss.

## What's in the app

- **Login first**: mobile number (+91) and a 6-digit OTP. Each mobile number gets its own tokens and trades on the device.
- **Scrips**: a watchlist of 12 large NSE scrips with last price and day change, plus your token balance.
- **Scrip screen**: TradingView Lightweight Charts candlesticks (5 min / 1 hour / 1 day), with your own buys and sells drawn as arrows. Buy or sell any quantity at the last price.
- **Tokens**: all practice money is tokens (1 token = ₹1 of practice value). New accounts get 1,00,000 welcome tokens. Buying takes tokens from the balance; selling returns them plus the profit or minus the loss.
- **Wallet**: token balance, free "Add tokens" top-ups (presets or any amount up to 10,00,000 at a time), results in tokens (top-ups are not counted as profit), win rate, open positions, reset and log out.
- **Journal**: every trade and top-up, with tokens won or lost on each sell.

## Login and OTP setup

The app ships in **demo OTP mode**: no SMS is sent and the code is always `123456` (the login screen says so). To send real SMS codes:

1. Build a small backend with two endpoints (contract in `src/lib/auth/otp.ts`):
   `POST /otp/send { phone } -> { requestId }` and `POST /otp/verify { phone, requestId, code } -> { userId, phone, token }`.
2. Have it send the SMS through an OTP service. Good options for India: **MSG91** or **2Factor.in** (cheap per-SMS pricing, Indian sender IDs), or **Firebase Authentication** phone sign-in / **Twilio Verify**. Keep the service's API keys on the server only.
3. For SMS to Indian numbers you need **DLT registration** (TRAI rule) of your business entity, sender ID and OTP template. MSG91 / 2Factor help with this; it usually takes a few days.
4. Set `EXPO_PUBLIC_OTP_API_URL=https://your-backend.example.com` when building, and the app switches from demo mode to the real service automatically.

Tokens and trades are stored on the phone for now. Syncing them to the backend (so they follow the user to a new phone) is the natural next step once the backend exists.

## Run it

```bash
npm install          # also bundles the chart library (postinstall)
npx expo start       # scan the QR code with Expo Go on your phone
npm test             # trading engine tests
npm run typecheck
```

Builds for the stores: `npx eas-cli@latest build -p ios` / `-p android` (needs an Expo account; Apple and Google developer accounts to publish).

## Charts and data: how TradingView fits in

TradingView does **not** sell or give away a market data API. What it offers is the chart software:

| TradingView product | Cost | Used here |
|---|---|---|
| Lightweight Charts (open source, Apache-2.0) | Free, keep the TradingView attribution | **Yes**, bundled into the app, runs offline |
| Advanced Charts / Trading Platform library | Free licence on application, for public web/apps; you bring your own data | Possible later upgrade (indicators, drawing tools) |
| Embedded widgets (with TradingView's data) | Free, but web-only iframes with TradingView branding; you can't read prices out of them, so you can't compute P&L | No |

So prices come from a separate feed behind a small interface (`src/lib/data/types.ts` → `MarketDataProvider`). Providers are tried in order:

1. **Yahoo Finance chart endpoint** (`src/lib/data/yahoo.ts`): free, NSE `.NS` / BSE `.BO`, ~15 min delayed. Unofficial, so fine for a prototype but **not for a store release**.
2. **Simulated prices** (`src/lib/data/simulated.ts`): always works offline. The app shows a banner when it's using these.

Before publishing, plug in a licensed feed, for example a broker API (Zerodha Kite Connect, Upstox, Angel One SmartAPI, Dhan) or a vendor such as TrueData or Global Datafeeds. NSE's terms for redistributing real-time data apply, which is why most practice apps use delayed data or a broker API. A real feed should run through your own backend so API keys never ship in the app.

## Project layout

```
src/app/                 screens (Expo Router)
  login.tsx              mobile number + OTP
  (tabs)/index.tsx       Scrips
  (tabs)/wallet.tsx      Wallet (tokens, add tokens, results)
  (tabs)/journal.tsx     Journal
  stock/[symbol].tsx     chart + order ticket
src/lib/auth/            OTP providers (demo + backend) and session
src/components/TradingChart.tsx   Lightweight Charts in a WebView
src/lib/portfolio.ts     pure trading engine (tested)
src/lib/data/            market data providers
```

## Ideas for next

- Replay mode: hide the future part of a historical chart, trade bar by bar, then reveal what happened.
- Short selling, stop-loss and limit orders, brokerage and STT charges.
- Search across all NSE/BSE symbols, user watchlists.
- Paid token packs via in-app purchase (top-ups are free for now).
- Accounts synced to a backend, and leaderboards.

## Web demo

The app also runs in a browser (on web the chart renders directly, without a WebView). To build a single-file demo page:

```bash
npx expo export --platform web
node scripts/build-web-demo.js   # writes dist-demo/index.html
```
