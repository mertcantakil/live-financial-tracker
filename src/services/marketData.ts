import { ASSETS, POLL_INTERVALS, TICK_FLUSH_MS } from '../config/assets'
import type { AssetDefinition, Candle, ConnectionStatus, FeedId, PriceTick, Timeframe } from '../types/market'
import { fetchSpotQuotes } from './awesomeApi'
import { BinanceTradeStream, fetchBinance24h, fetchBinanceKlines } from './binance'
import { createPoller } from './poller'
import { fetchYahooCandles, fetchYahooQuotes, type CandleRequestOptions } from './yahoo'

/** Assets whose chart tail is driven by the trade WebSocket (others poll their candle source). */
export const isStreamedAsset = (asset: AssetDefinition): boolean =>
  asset.quoteSource === 'binance' && Boolean(asset.binanceSymbol)

/** Routes candle requests to the best provider for the asset class. */
export function fetchCandles(asset: AssetDefinition, timeframe: Timeframe, opts?: CandleRequestOptions): Promise<Candle[]> {
  if (isStreamedAsset(asset)) {
    return fetchBinanceKlines(asset.binanceSymbol!, timeframe, { ...opts, limit: opts?.tail ? 2 : undefined })
  }
  return fetchYahooCandles(asset.yahooSymbol, timeframe, opts)
}

/** Human-readable data source label shown under the chart. */
export const candleSourceLabel = (asset: AssetDefinition): string =>
  isStreamedAsset(asset) ? `Binance · ${asset.binanceSymbol}` : `Yahoo Finance · ${asset.yahooSymbol}`

export interface MarketFeedHandlers {
  /** Receives coalesced ticks (latest per asset) at most every `TICK_FLUSH_MS`. */
  onTicks: (ticks: PriceTick[]) => void
  onStatus: (feed: FeedId, status: ConnectionStatus, info?: { attempt: number; retryAt?: number; error?: string }) => void
}

/**
 * Coalesces high-frequency ticks so that bursts of trades (dozens per second
 * on BTC) produce a single store update per flush window.
 */
function createTickBuffer(flush: (ticks: PriceTick[]) => void, intervalMs: number) {
  const pending = new Map<string, PriceTick>()
  let timer: ReturnType<typeof setTimeout> | undefined

  const drain = () => {
    timer = undefined
    if (!pending.size) return
    const batch = Array.from(pending.values())
    pending.clear()
    flush(batch)
  }

  return {
    push(tick: PriceTick) {
      const prev = pending.get(tick.id)
      pending.set(tick.id, {
        ...tick,
        reference: tick.reference ?? prev?.reference,
        volume: (prev?.volume ?? 0) + (tick.volume ?? 0),
      })
      timer ??= setTimeout(drain, intervalMs)
    },
    dispose() {
      clearTimeout(timer)
      pending.clear()
    },
  }
}

/** Starts every live feed (Binance WS, gold & equity pollers). Returns a disposer. */
export function startMarketFeeds({ onTicks, onStatus }: MarketFeedHandlers): () => void {
  const buffer = createTickBuffer(onTicks, TICK_FLUSH_MS)

  const crypto = ASSETS.filter((a) => a.quoteSource === 'binance' && a.binanceSymbol)
  const gold = ASSETS.filter((a) => a.quoteSource === 'awesome' && a.awesomePair)
  const equities = ASSETS.filter((a) => a.quoteSource === 'yahoo')

  const symbolToId = Object.fromEntries(crypto.map((a) => [a.binanceSymbol!, a.id]))

  // Seed 24h reference prices so % change is correct before the first trade arrives.
  const seedController = new AbortController()
  fetchBinance24h(Object.keys(symbolToId), { signal: seedController.signal })
    .then((rows) =>
      onTicks(rows.map((r) => ({ id: symbolToId[r.symbol], price: r.price, reference: r.open24h, timestamp: r.timestamp }))),
    )
    .catch(() => {
      /* The WS stream still provides prices; % change shows once reference is available. */
    })

  const binance = new BinanceTradeStream(Object.keys(symbolToId), {
    symbolToId,
    onTick: buffer.push,
    onStatus: (status, info) => onStatus('binance-ws', status, info),
  })

  const goldPoller = createPoller({
    intervalMs: POLL_INTERVALS.goldMs,
    onStatus: (status, info) => onStatus('gold', status, info),
    task: async (signal) => {
      try {
        const quotes = await fetchSpotQuotes(gold.map((a) => a.awesomePair!), { signal, retries: 1 })
        onTicks(
          quotes.map((q) => ({
            id: gold.find((a) => a.awesomePair === q.pair)!.id,
            price: q.price,
            reference: q.previousClose,
            timestamp: q.timestamp,
          })),
        )
      } catch (err) {
        if (signal.aborted) throw err
        // Fallback: COMEX gold futures via Yahoo when AwesomeAPI is rate-limited.
        const quotes = await fetchYahooQuotes(gold.map((a) => a.yahooSymbol), { signal, retries: 0 })
        if (!quotes.length) throw err
        onTicks(
          quotes.map((q) => ({
            id: gold.find((a) => a.yahooSymbol === q.symbol)!.id,
            price: q.price,
            reference: q.previousClose,
            timestamp: q.timestamp,
          })),
        )
      }
    },
  })

  const equityPoller = createPoller({
    intervalMs: POLL_INTERVALS.equitiesMs,
    onStatus: (status, info) => onStatus('equities', status, info),
    task: async (signal) => {
      const quotes = await fetchYahooQuotes(
        equities.map((a) => a.yahooSymbol),
        { signal, retries: 1 },
      )
      const bySymbol = new Map(equities.map((a) => [a.yahooSymbol, a.id]))
      onTicks(
        quotes.map((q) => ({ id: bySymbol.get(q.symbol)!, price: q.price, reference: q.previousClose, timestamp: q.timestamp })),
      )
    },
  })

  binance.start()
  goldPoller.start()
  equityPoller.start()

  return () => {
    seedController.abort()
    binance.stop()
    goldPoller.stop()
    equityPoller.stop()
    buffer.dispose()
  }
}
