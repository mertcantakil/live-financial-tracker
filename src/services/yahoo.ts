import type { Candle, Timeframe } from '../types/market'
import { API_BASE } from './apiBase'
import { ApiError, buildUrl, getJson, type RequestOptions } from './http'

const CHART_BASE = `${API_BASE}/yahoo`

/** Yahoo caps intraday history (1m ≤ 7d, 15m ≤ 60d, 60m ≤ 730d). */
const PARAMS: Record<Timeframe, { interval: string; range: string }> = {
  '1m': { interval: '1m', range: '5d' },
  '15m': { interval: '15m', range: '1mo' },
  '1h': { interval: '60m', range: '6mo' },
  '1D': { interval: '1d', range: '2y' },
  '1W': { interval: '1wk', range: '10y' },
}

/** Short ranges used to refresh only the most recent bars. */
const TAIL_RANGE: Record<Timeframe, string> = {
  '1m': '1d',
  '15m': '1d',
  '1h': '5d',
  '1D': '5d',
  '1W': '1mo',
}

export interface CandleRequestOptions extends RequestOptions {
  /** Fetch only the latest few bars (for live tail updates). */
  tail?: boolean
}

interface ChartResponse {
  chart: {
    result:
      | {
          meta: { regularMarketPrice?: number; previousClose?: number; chartPreviousClose?: number; regularMarketTime?: number }
          timestamp?: number[]
          indicators: {
            quote: { open: (number | null)[]; high: (number | null)[]; low: (number | null)[]; close: (number | null)[]; volume: (number | null)[] }[]
          }
        }[]
      | null
    error: { code: string; description: string } | null
  }
}

export async function fetchYahooCandles(symbol: string, timeframe: Timeframe, opts?: CandleRequestOptions): Promise<Candle[]> {
  const { interval, range } = PARAMS[timeframe]
  const url = buildUrl(`${CHART_BASE}/v8/finance/chart/${encodeURIComponent(symbol)}`, {
    interval,
    range: opts?.tail ? TAIL_RANGE[timeframe] : range,
    includePrePost: 'false',
  })
  const json = await getJson<ChartResponse>(url, opts)
  const result = json.chart.result?.[0]
  if (!result) throw new ApiError('parse', json.chart.error?.description ?? 'Empty chart result')

  const ts = result.timestamp ?? []
  const q = result.indicators.quote[0]
  if (!q) return []

  const candles: Candle[] = []
  let lastTime = -Infinity
  for (let i = 0; i < ts.length; i++) {
    const open = q.open[i]
    const high = q.high[i]
    const low = q.low[i]
    const close = q.close[i]
    // Yahoo pads gaps with nulls and occasionally repeats the last timestamp.
    if (open == null || high == null || low == null || close == null) continue
    const time = ts[i]
    if (time <= lastTime) {
      const prev = candles[candles.length - 1]
      prev.high = Math.max(prev.high, high)
      prev.low = Math.min(prev.low, low)
      prev.close = close
      continue
    }
    candles.push({ time, open, high, low, close, volume: q.volume[i] ?? 0 })
    lastTime = time
  }
  return candles
}

interface SparkEntry {
  symbol: string
  timestamp?: number[]
  close?: (number | null)[]
  previousClose?: number
  chartPreviousClose?: number
}

export interface YahooQuote {
  symbol: string
  price: number
  previousClose: number
  /** UNIX ms. */
  timestamp: number
}

/** Batched latest-price lookup for many tickers in a single request. */
export async function fetchYahooQuotes(symbols: string[], opts?: RequestOptions): Promise<YahooQuote[]> {
  const url = buildUrl(`${CHART_BASE}/v8/finance/spark`, {
    symbols: symbols.join(','),
    range: '1d',
    interval: '5m',
  })
  const json = await getJson<Record<string, SparkEntry>>(url, opts)

  const quotes: YahooQuote[] = []
  for (const symbol of symbols) {
    const entry = json[symbol]
    if (!entry?.close?.length || !entry.timestamp?.length) continue
    let idx = entry.close.length - 1
    while (idx >= 0 && entry.close[idx] == null) idx--
    if (idx < 0) continue
    const price = entry.close[idx] as number
    quotes.push({
      symbol,
      price,
      previousClose: entry.previousClose ?? entry.chartPreviousClose ?? price,
      timestamp: entry.timestamp[Math.min(idx, entry.timestamp.length - 1)] * 1_000,
    })
  }
  return quotes
}
