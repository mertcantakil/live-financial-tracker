import { useCallback } from 'react'
import { fetchCandles } from '../services/marketData'
import type { AssetDefinition, Candle, Timeframe } from '../types/market'
import { useAsyncResource } from './useAsyncResource'

export function useCandles(asset: AssetDefinition, timeframe: Timeframe) {
  const fetcher = useCallback(
    (signal: AbortSignal) => fetchCandles(asset, timeframe, { signal }),
    [asset, timeframe],
  )
  return useAsyncResource<Candle[]>(`candles:${asset.id}:${timeframe}`, fetcher, { ttlMs: 20_000 })
}
