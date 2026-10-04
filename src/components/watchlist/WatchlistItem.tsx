import { TrendingDown, TrendingUp } from 'lucide-react'
import { memo, useRef } from 'react'
import { ASSET_MAP } from '../../config/assets'
import { usePriceFlash } from '../../hooks/usePriceFlash'
import { cn, formatPercent, formatPrice } from '../../lib/format'
import { useIsSelected, useQuote } from '../../store/useMarketStore'

interface Props {
  id: string
  onSelect: (id: string) => void
}

/**
 * Each row subscribes only to its own quote and its own "selected" flag,
 * so a BTC tick re-renders exactly one row and nothing else.
 */
export const WatchlistItem = memo(function WatchlistItem({ id, onSelect }: Props) {
  const asset = ASSET_MAP[id]
  const quote = useQuote(id)
  const selected = useIsSelected(id)
  const priceRef = useRef<HTMLSpanElement>(null)
  usePriceFlash(priceRef, quote?.price)

  const up = (quote?.changePct ?? 0) >= 0
  const Trend = up ? TrendingUp : TrendingDown

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(id)}
        aria-current={selected ? 'true' : undefined}
        className={cn(
          'group grid w-full grid-cols-[1fr_auto] items-center gap-x-3 border-l-2 px-3 py-2.5 text-left transition-colors max-lg:py-3.5',
          selected ? 'border-accent bg-accent/10' : 'border-transparent hover:bg-panel-2 active:bg-panel-2',
        )}
      >
        <div className="min-w-0">
          <p className={cn('truncate text-sm font-medium', selected ? 'text-fg' : 'text-fg/90')}>{asset.displaySymbol}</p>
          <p className="truncate text-[11px] text-muted">{asset.name}</p>
        </div>

        <div className="text-right">
          <span ref={priceRef} className="block rounded px-1 font-mono text-sm tabular-nums text-fg">
            {quote ? formatPrice(quote.price, asset.pricePrecision) : <span className="skeleton inline-block h-3.5 w-16" />}
          </span>
          <span
            className={cn(
              'mt-0.5 inline-flex items-center gap-1 font-mono text-[11px] tabular-nums',
              !quote ? 'text-muted' : up ? 'text-up' : 'text-down',
            )}
          >
            {quote && <Trend className="size-3" />}
            {quote ? formatPercent(quote.changePct) : '—'}
          </span>
        </div>
      </button>
    </li>
  )
})
