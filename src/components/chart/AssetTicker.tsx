import { memo, useRef } from 'react'
import { usePriceFlash } from '../../hooks/usePriceFlash'
import { cn, formatPercent, formatPrice } from '../../lib/format'
import { useQuote } from '../../store/useMarketStore'
import type { AssetDefinition } from '../../types/market'

/** Large live price for the focused asset; the only part of the chart header that re-renders on ticks. */
export const AssetTicker = memo(function AssetTicker({ asset }: { asset: AssetDefinition }) {
  const quote = useQuote(asset.id)
  const ref = useRef<HTMLSpanElement>(null)
  usePriceFlash(ref, quote?.price)
  const up = (quote?.change ?? 0) >= 0

  return (
    <div className="flex flex-wrap items-baseline gap-x-3">
      <span ref={ref} className="-ml-1 rounded px-1 font-mono text-xl font-semibold tabular-nums text-fg sm:text-2xl">
        {quote ? formatPrice(quote.price, asset.pricePrecision) : <span className="skeleton inline-block h-6 w-32" />}
      </span>
      {quote && (
        <span className={cn('font-mono text-xs tabular-nums sm:text-sm', up ? 'text-up' : 'text-down')}>
          {up ? '+' : ''}
          {formatPrice(quote.change, asset.pricePrecision)} ({formatPercent(quote.changePct)})
        </span>
      )}
    </div>
  )
})
