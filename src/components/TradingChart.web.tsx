// Web version of the chart: Lightweight Charts runs directly in the page, no WebView.
import { CandlestickSeries, createChart, createSeriesMarkers, type IChartApi, type ISeriesApi, type ISeriesMarkersPluginApi, type SeriesMarker, type Time, type UTCTimestamp } from 'lightweight-charts';
import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import type { Candle } from '../lib/data';
import { colors } from '../lib/format';
import type { Trade } from '../lib/portfolio';
import { tradeMarkers } from './chartMarkers';

interface Props {
  candles: Candle[];
  trades: Trade[];
  height?: number;
}

export function TradingChart({ candles, trades, height = 320 }: Props) {
  const host = useRef<unknown>(null);
  const chart = useRef<{ chart: IChartApi; series: ISeriesApi<'Candlestick'>; markers: ISeriesMarkersPluginApi<Time>; fitted: boolean } | null>(null);

  useEffect(() => {
    const el = host.current as unknown as HTMLElement | null;
    if (!el) return;
    const c = createChart(el, {
      autoSize: true,
      layout: { background: { color: colors.card }, textColor: colors.muted, attributionLogo: true },
      grid: { vertLines: { color: colors.border }, horzLines: { color: colors.border } },
      rightPriceScale: { borderColor: colors.border },
      timeScale: { borderColor: colors.border, timeVisible: true, secondsVisible: false },
      localization: {
        priceFormatter: (p: number) => '₹' + p.toFixed(2),
        timeFormatter: (t: number) =>
          new Date(t * 1000).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
      },
    });
    const series = c.addSeries(CandlestickSeries, {
      upColor: colors.profit, downColor: colors.loss, borderVisible: false, wickUpColor: colors.profit, wickDownColor: colors.loss,
    });
    chart.current = { chart: c, series, markers: createSeriesMarkers(series, []), fitted: false };
    return () => {
      c.remove();
      chart.current = null;
    };
  }, []);

  useEffect(() => {
    const ch = chart.current;
    if (!ch) return;
    ch.series.setData(candles.map(({ time, open, high, low, close }) => ({ time: time as UTCTimestamp, open, high, low, close })));
    ch.markers.setMarkers(tradeMarkers(candles, trades) as SeriesMarker<Time>[]);
    if (!ch.fitted && candles.length) {
      ch.chart.timeScale().fitContent();
      ch.fitted = true;
    }
  }, [candles, trades]);

  return <View ref={host as React.Ref<never>} style={{ height, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.card }} />;
}
