import { CandlestickSeries, createChart, createSeriesMarkers, type IChartApi, type ISeriesApi, type ISeriesMarkersPluginApi, type Time, type UTCTimestamp } from 'lightweight-charts';
import { createElement, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Candle } from '../lib/data';
import { colors } from '../lib/format';
import type { Trade } from '../lib/portfolio';
import { candleOptions, chartOptions, tradeMarkers } from './chartMarkers';

interface Props {
  candles: Candle[];
  trades: Trade[];
  height?: number;
}

/** Web version: TradingView Lightweight Charts drawn straight into the page. */
export function TradingChart({ candles, trades, height = 320 }: Props) {
  const host = useRef<HTMLDivElement | null>(null);
  const chart = useRef<{ api: IChartApi; series: ISeriesApi<'Candlestick'>; markers: ISeriesMarkersPluginApi<Time>; fitted: boolean } | null>(null);

  useEffect(() => {
    if (!host.current) return;
    const api = createChart(host.current, {
      autoSize: true,
      ...chartOptions,
      localization: {
        priceFormatter: (p: number) => '₹' + p.toFixed(2),
        timeFormatter: (t: number) =>
          new Date(t * 1000).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
      },
    });
    const series = api.addSeries(CandlestickSeries, candleOptions);
    chart.current = { api, series, markers: createSeriesMarkers(series, []), fitted: false };
    return () => {
      api.remove();
      chart.current = null;
    };
  }, []);

  useEffect(() => {
    const c = chart.current;
    if (!c) return;
    c.series.setData(candles.map(({ time, open, high, low, close }) => ({ time: time as UTCTimestamp, open, high, low, close })));
    c.markers.setMarkers(tradeMarkers(candles, trades).map((m) => ({ ...m, time: m.time as UTCTimestamp })));
    if (!c.fitted && candles.length) {
      c.api.timeScale().fitContent();
      c.fitted = true;
    }
  }, [candles, trades]);

  return (
    <View style={[styles.wrap, { height }]}>
      {createElement('div', { ref: host, style: { width: '100%', height: '100%' } })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 8, overflow: 'hidden', backgroundColor: colors.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
});
