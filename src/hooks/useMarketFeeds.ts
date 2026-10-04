import { useEffect } from 'react'
import { startMarketFeeds } from '../services/marketData'
import { getMarketState } from '../store/useMarketStore'

/** Mounts all live market feeds once for the app lifetime. Never causes a re-render itself. */
export function useMarketFeeds(): void {
  useEffect(() => {
    const { applyTicks, setFeedStatus } = getMarketState().actions
    return startMarketFeeds({ onTicks: applyTicks, onStatus: setFeedStatus })
  }, [])
}
