import {
  CandlestickSeries,
  ColorType,
  createChart,
  CrosshairMode,
  HistogramSeries,
  LineStyle,
  TickMarkType,
  type CandlestickData,
  type HistogramData,
  type IChartApi,
  type ISeriesApi,
  type MouseEventParams,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts'
import { memo, useCallback, useEffect, useRef } from 'react'
import { useRealtimeBars } from '../../hooks/useRealtimeBars'
import { formatCompact, formatPrice } from '../../lib/format'
import type { AssetDefinition, Candle, Timeframe } from '../../types/market'

const COLORS = {
  bg: '#0b0e14',
  grid: 'rgba(42, 46, 57, 0.45)',
  text: '#8b93a7',
  border: '#1e2530',
  up: '#26a69a',
  down: '#ef5350',
  upVol: 'rgba(38, 166, 154, 0.35)',
  downVol: 'rgba(239, 83, 80, 0.35)',
  crosshair: '#5d6b85',
} as const

const toCandle = (c: Candle): CandlestickData<UTCTimestamp> => ({
  time: c.time as UTCTimestamp,
  open: c.open,
  high: c.high,
  low: c.low,
  close: c.close,
})

const toVolume = (c: Candle): HistogramData<UTCTimestamp> => ({
  time: c.time as UTCTimestamp,
  value: c.volume,
  color: c.close >= c.open ? COLORS.upVol : COLORS.downVol,
})

const timeFmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })
const dayFmt = new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short' })
const monthFmt = new Intl.DateTimeFormat(undefined, { month: 'short', year: '2-digit' })
const fullFmt = new Intl.DateTimeFormat(undefined, {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

/** Renders axis labels in the viewer's local timezone (series data stays in UTC). */
const tickMarkFormatter = (time: Time, type: TickMarkType): string => {
  const d = new Date((time as number) * 1_000)
  switch (type) {
    case TickMarkType.Year:
      return String(d.getFullYear())
    case TickMarkType.Month:
      return monthFmt.format(d)
    case TickMarkType.DayOfMonth:
      return dayFmt.format(d)
    default:
      return timeFmt.format(d)
  }
}

interface Props {
  asset: AssetDefinition
  timeframe: Timeframe
  candles: Candle[] | undefined
}

function CandlestickChartImpl({ asset, timeframe, candles }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const legendRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const lastBarRef = useRef<Candle | null>(null)
  const volumeByTimeRef = useRef(new Map<number, number>())
  const precisionRef = useRef(asset.pricePrecision)
  const fittedKeyRef = useRef<string | null>(null)

  const renderLegend = useCallback((bar: Candle | null) => {
    const el = legendRef.current
    if (!el) return
    if (!bar) {
      el.textContent = ''
      return
    }
    const p = precisionRef.current
    const up = bar.close >= bar.open
    const change = bar.open ? ((bar.close - bar.open) / bar.open) * 100 : 0
    el.dataset.direction = up ? 'up' : 'down'
    el.innerHTML =
      `<span>O <b>${formatPrice(bar.open, p)}</b></span>` +
      `<span>H <b>${formatPrice(bar.high, p)}</b></span>` +
      `<span>L <b>${formatPrice(bar.low, p)}</b></span>` +
      `<span>C <b>${formatPrice(bar.close, p)}</b></span>` +
      `<span><b>${change >= 0 ? '+' : ''}${change.toFixed(2)}%</b></span>` +
      `<span class="hidden sm:inline">Vol <b>${formatCompact(bar.volume)}</b></span>`
  }, [])

  // Create the chart exactly once; all later updates are imperative.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: COLORS.bg },
        textColor: COLORS.text,
        fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 11,
        attributionLogo: true,
      },
      grid: {
        vertLines: { color: COLORS.grid },
        horzLines: { color: COLORS.grid },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: COLORS.crosshair, style: LineStyle.Dashed, labelBackgroundColor: '#1e2530' },
        horzLine: { color: COLORS.crosshair, style: LineStyle.Dashed, labelBackgroundColor: '#1e2530' },
      },
      rightPriceScale: { borderColor: COLORS.border, scaleMargins: { top: 0.08, bottom: 0.25 } },
      timeScale: {
        borderColor: COLORS.border,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 6,
        tickMarkFormatter,
      },
      localization: {
        timeFormatter: (time: Time) => fullFmt.format(new Date((time as number) * 1_000)),
      },
    })

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: COLORS.up,
      downColor: COLORS.down,
      borderVisible: false,
      wickUpColor: COLORS.up,
      wickDownColor: COLORS.down,
      priceLineStyle: LineStyle.Dotted,
    })

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
      lastValueVisible: false,
      priceLineVisible: false,
    })
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } })

    const onCrosshairMove = (param: MouseEventParams) => {
      const data = (param.time ? param.seriesData.get(candleSeries) : undefined) as CandlestickData | undefined
      if (!data || data.open === undefined) {
        renderLegend(lastBarRef.current)
        return
      }
      const vol = volumeByTimeRef.current.get(data.time as number) ?? 0
      renderLegend({ time: data.time as number, open: data.open, high: data.high, low: data.low, close: data.close, volume: vol })
    }
    chart.subscribeCrosshairMove(onCrosshairMove)

    chartRef.current = chart
    candleSeriesRef.current = candleSeries
    volumeSeriesRef.current = volumeSeries

    return () => {
      chart.unsubscribeCrosshairMove(onCrosshairMove)
      chart.remove()
      chartRef.current = null
      candleSeriesRef.current = null
      volumeSeriesRef.current = null
    }
  }, [renderLegend])

  useEffect(() => {
    precisionRef.current = asset.pricePrecision
    candleSeriesRef.current?.applyOptions({
      priceFormat: { type: 'price', precision: asset.pricePrecision, minMove: 1 / 10 ** asset.pricePrecision },
    })
  }, [asset.pricePrecision])

  // Full data replacement only when a new history snapshot arrives.
  useEffect(() => {
    const candleSeries = candleSeriesRef.current
    const volumeSeries = volumeSeriesRef.current
    if (!candleSeries || !volumeSeries) return

    const data = candles ?? []
    candleSeries.setData(data.map(toCandle))
    volumeSeries.setData(data.map(toVolume))
    volumeByTimeRef.current = new Map(data.map((c) => [c.time, c.volume]))
    lastBarRef.current = data.length ? data[data.length - 1] : null
    renderLegend(lastBarRef.current)

    const key = `${asset.id}:${timeframe}`
    if (data.length && fittedKeyRef.current !== key) {
      fittedKeyRef.current = key
      const ts = chartRef.current?.timeScale()
      ts?.fitContent()
      if (data.length > 150) ts?.setVisibleLogicalRange({ from: data.length - 150, to: data.length + 5 })
    }
  }, [candles, asset.id, timeframe, renderLegend])

  // Live tail: O(1) imperative updates, no React re-render.
  const onBar = useCallback(
    (bar: Candle) => {
      const candleSeries = candleSeriesRef.current
      const volumeSeries = volumeSeriesRef.current
      if (!candleSeries || !volumeSeries) return
      try {
        candleSeries.update(toCandle(bar))
        volumeSeries.update(toVolume(bar))
      } catch {
        return // out-of-order bar (older than the series tail)
      }
      volumeByTimeRef.current.set(bar.time, bar.volume)
      lastBarRef.current = bar
      renderLegend(bar)
    },
    [renderLegend],
  )

  useRealtimeBars(asset, timeframe, candles, onBar)

  return (
    <div className="relative h-full w-full">
      <div
        ref={legendRef}
        className="chart-legend pointer-events-none absolute left-3 top-2 z-10 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[11px] text-muted"
      />
      <div ref={containerRef} className="h-full w-full" />
    </div>
  )
}

export const CandlestickChart = memo(CandlestickChartImpl)
