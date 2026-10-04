import { memo } from 'react'
import { TIMEFRAMES } from '../../config/assets'
import { cn } from '../../lib/format'
import { useMarketActions, useTimeframe } from '../../store/useMarketStore'

export const TimeframeSelector = memo(function TimeframeSelector() {
  const timeframe = useTimeframe()
  const { setTimeframe } = useMarketActions()

  return (
    <div role="radiogroup" aria-label="Zaman aralığı" className="flex rounded-md border border-line bg-bg p-0.5 max-sm:w-full">
      {TIMEFRAMES.map((tf) => (
        <button
          key={tf}
          type="button"
          role="radio"
          aria-checked={tf === timeframe}
          onClick={() => setTimeframe(tf)}
          className={cn(
            'rounded px-2.5 py-1 font-mono text-xs transition-colors max-sm:flex-1 max-sm:py-2',
            tf === timeframe ? 'bg-accent text-white' : 'text-muted hover:bg-panel-2 hover:text-fg',
          )}
        >
          {tf}
        </button>
      ))}
    </div>
  )
})
