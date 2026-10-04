import { useEffect, useLayoutEffect, useRef } from 'react'
import { POLL_INTERVALS, TIMEFRAME_SECONDS } from '../config/assets'
import { fetchCandles, isStreamedAsset } from '../services/marketData'
import { useMarketStore } from '../store/useMarketStore'
import type { AssetDefinition, Candle, Quote, Timeframe } from '../types/market'

/** Folds a trade into the current bar or opens a new one on the series' own time grid. */
export function foldTick(last: Candle, quote: Quote, stepSec: number): Candle {
  const t = Math.floor(quote.updatedAt / 1_000)
  const { price, tickVolume } = quote

  if (t < last.time + stepSec) {
    return {
      ...last,
      high: Math.max(last.high, price),
      low: Math.min(last.low, price),
      close: price,
      volume: last.volume + tickVolume,
    }
  }
  const steps = Math.floor((t - last.time) / stepSec)
  return { time: last.time + steps * stepSec, open: price, high: price, low: price, close: price, volume: tickVolume }
}

/**
 * Pushes live bar updates to `onBar` without touching React state:
 * - streamed assets (Binance): folds WebSocket trades from the store, back-fills via REST after reconnects
 * - polled assets (Yahoo): refreshes the last few bars from the candle source on an interval
 */
export function useRealtimeBars(
  asset: AssetDefinition,
  timeframe: Timeframe,
  seed: Candle[] | undefined,
  onBar: (bar: Candle) => void,
): void {
  const onBarRef = useRef(onBar)
  useLayoutEffect(() => {
    onBarRef.current = onBar
  })

  useEffect(() => {
    if (!seed?.length) return
    let last: Candle = { ...seed[seed.length - 1] }
    const stepSec = TIMEFRAME_SECONDS[timeframe]
    let controller: AbortController | null = null

    const applyBars = (bars: Candle[]) => {
      for (const bar of bars) {
        if (bar.time < last.time) continue
        last = { ...bar }
        onBarRef.current(last)
      }
    }

    const refreshTail = async () => {
      controller?.abort()
      controller = new AbortController()
      try {
        applyBars(await fetchCandles(asset, timeframe, { signal: controller.signal, tail: true, retries: 0 }))
      } catch {
        /* transient: next cycle / reconnect will retry */
      }
    }

    if (isStreamedAsset(asset)) {
      // Seed may come from cache; reconcile the latest bars before folding trades.
      void refreshTail()
      const unsubscribe = useMarketStore.subscribe((state, prev) => {
        const quote = state.quotes[asset.id]
        if (quote && quote !== prev.quotes[asset.id] && quote.updatedAt > 0) {
          last = foldTick(last, quote, stepSec)
          onBarRef.current(last)
        }
        const ws = state.feeds['binance-ws'].status
        if (ws === 'open' && prev.feeds['binance-ws'].status !== 'open') void refreshTail()
      })
      return () => {
        unsubscribe()
        controller?.abort()
      }
    }

    const timer = setInterval(() => {
      if (!document.hidden) void refreshTail()
    }, POLL_INTERVALS.equitiesMs)
    return () => {
      clearInterval(timer)
      controller?.abort()
    }
  }, [asset, timeframe, seed])
}
