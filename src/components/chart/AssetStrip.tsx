import { memo, useEffect, useRef } from 'react'
import { ASSET_MAP, ASSETS } from '../../config/assets'
import { cn, formatPercent } from '../../lib/format'
import { useIsSelected, useMarketActions, useQuote } from '../../store/useMarketStore'

const StripChip = memo(function StripChip({ id, onSelect }: { id: string; onSelect: (id: string) => void }) {
  const asset = ASSET_MAP[id]
  const quote = useQuote(id)
  const selected = useIsSelected(id)
  const ref = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [selected])

  const up = (quote?.changePct ?? 0) >= 0
  return (
    <button
      ref={ref}
      type="button"
      onClick={() => onSelect(id)}
      aria-pressed={selected}
      className={cn(
        'flex shrink-0 snap-start flex-col items-start rounded-md border px-3 py-1.5 text-left transition-colors',
        selected ? 'border-accent bg-accent/10' : 'border-line bg-panel active:bg-panel-2',
      )}
    >
      <span className="text-xs font-semibold text-fg">{asset.displaySymbol}</span>
      <span className={cn('font-mono text-[11px] tabular-nums', !quote ? 'text-muted' : up ? 'text-up' : 'text-down')}>
        {quote ? formatPercent(quote.changePct) : '—'}
      </span>
    </button>
  )
})

/** Horizontally scrollable asset switcher for small screens. */
export const AssetStrip = memo(function AssetStrip() {
  const { selectAsset } = useMarketActions()
  return (
    <div className="scrollbar-none flex snap-x gap-2 overflow-x-auto border-b border-line px-3 py-2 lg:hidden">
      {ASSETS.map((a) => (
        <StripChip key={a.id} id={a.id} onSelect={selectAsset} />
      ))}
    </div>
  )
})
