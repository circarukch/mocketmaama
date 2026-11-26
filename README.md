# Mocket Maama

A paper trading app for iOS and Android. Practise buying and selling NSE stocks with ₹10 lakh of virtual money, see your trades on TradingView charts, and find out whether each decision made a profit or a loss.

## What's in v0.1

- **Markets**: a watchlist of 12 large NSE stocks with last price and day change.
- **Stock screen**: TradingView Lightweight Charts candlesticks (5 min / 1 hour / 1 day), with your own buys and sells drawn as arrows on the chart. Buy or sell any quantity at the last price.
- **Portfolio**: account value, total P&L since you started, booked vs open P&L, win rate, open positions.
- **Journal**: every trade, with the profit or loss of each sell and your best and worst calls.
- Everything is saved on the phone (AsyncStorage). "Reset practice account" starts over.

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
  (tabs)/index.tsx       Markets
  (tabs)/portfolio.tsx   Portfolio
  (tabs)/journal.tsx     Journal
  stock/[symbol].tsx     chart + order ticket
src/components/TradingChart.tsx   Lightweight Charts in a WebView
src/lib/portfolio.ts     pure trading engine (tested)
src/lib/data/            market data providers
```

## Ideas for next

- Replay mode: hide the future part of a historical chart, trade bar by bar, then reveal what happened.
- Short selling, stop-loss and limit orders, brokerage and STT charges.
- Search across all NSE/BSE symbols, user watchlists.
- Accounts and leaderboards (needs a backend).
