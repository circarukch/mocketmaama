import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { WebView as RNWebView, type WebViewProps } from 'react-native-webview';
import { LIGHTWEIGHT_CHARTS_JS } from '../generated/lightweightCharts';
import type { Candle } from '../lib/data';
import { colors } from '../lib/format';
import type { Trade } from '../lib/portfolio';

interface Props {
  candles: Candle[];
  trades: Trade[]; // this symbol's trades, drawn as buy/sell markers
  height?: number;
}

// TradingView Lightweight Charts runs inside a WebView. The library is bundled
// with the app (see scripts/bundle-chart-lib.js), so nothing loads remotely.
// react-native-webview's class typings resolve to `never` props under React 19 types.
type WebViewHandle = { injectJavaScript: (js: string) => void };
const WebView = RNWebView as unknown as React.ComponentType<WebViewProps & { ref?: React.Ref<WebViewHandle> }>;

const html = `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>html,body,#c{margin:0;padding:0;height:100%;width:100%;background:${colors.card};overflow:hidden}</style>
<script>${LIGHTWEIGHT_CHARTS_JS}</script></head><body><div id="c"></div><script>
const LWC = window.LightweightCharts;
const chart = LWC.createChart(document.getElementById('c'), {
  autoSize: true,
  layout: { background: { color: '${colors.card}' }, textColor: '${colors.muted}', attributionLogo: true },
  grid: { vertLines: { color: '${colors.border}' }, horzLines: { color: '${colors.border}' } },
  rightPriceScale: { borderColor: '${colors.border}' },
  timeScale: { borderColor: '${colors.border}', timeVisible: true, secondsVisible: false },
  localization: {
    priceFormatter: p => '₹' + p.toFixed(2),
    timeFormatter: t => new Date(t * 1000).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
  },
});
const series = chart.addSeries(LWC.CandlestickSeries, {
  upColor: '${colors.profit}', downColor: '${colors.loss}', borderVisible: false,
  wickUpColor: '${colors.profit}', wickDownColor: '${colors.loss}',
});
const markers = LWC.createSeriesMarkers(series, []);
let first = true;
window.update = function (candles, marks) {
  series.setData(candles);
  markers.setMarkers(marks);
  if (first) { chart.timeScale().fitContent(); first = false; }
};
window.ReactNativeWebView && window.ReactNativeWebView.postMessage('ready');
</script></body></html>`;

export function TradingChart({ candles, trades, height = 320 }: Props) {
  const ref = useRef<WebViewHandle>(null);
  const [ready, setReady] = useState(false);

  const payload = useMemo(() => {
    const times = candles.map((c) => c.time);
    const snap = (sec: number) => {
      // place each trade on the candle it happened in
      let lo = 0, hi = times.length - 1, ans = -1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (times[mid] <= sec) { ans = mid; lo = mid + 1; } else hi = mid - 1;
      }
      return ans >= 0 ? times[ans] : undefined;
    };
    const marks = trades
      .map((t) => {
        const time = snap(Math.floor(t.time / 1000));
        if (time === undefined) return null;
        const buy = t.side === 'BUY';
        return {
          time,
          position: buy ? 'belowBar' : 'aboveBar',
          color: buy ? colors.profit : colors.loss,
          shape: buy ? 'arrowUp' : 'arrowDown',
          text: `${buy ? 'B' : 'S'} ${t.qty}`,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a!.time - b!.time);
    const data = candles.map(({ time, open, high, low, close }) => ({ time, open, high, low, close }));
    return JSON.stringify([data, marks]);
  }, [candles, trades]);

  useEffect(() => {
    if (ready) ref.current?.injectJavaScript(`window.update(...${payload}); true;`);
  }, [ready, payload]);

  return (
    <View style={[styles.wrap, { height }]}>
      <WebView
        ref={ref}
        originWhitelist={['*']}
        source={{ html }}
        onMessage={(e) => e.nativeEvent.data === 'ready' && setReady(true)}
        scrollEnabled={false}
        style={styles.web}
        // The TradingView attribution link opens in the system browser, not inside the chart.
        onShouldStartLoadWithRequest={(r) => {
          if (/^https?:/.test(r.url)) {
            Linking.openURL(r.url).catch(() => {});
            return false;
          }
          return true;
        }}
        setSupportMultipleWindows={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 12, overflow: 'hidden', backgroundColor: colors.card },
  web: { backgroundColor: colors.card },
});
