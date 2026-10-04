import { Coins, Gem, Landmark, Search } from 'lucide-react'
import { memo, useDeferredValue, useMemo, useState, type ComponentType } from 'react'
import { ASSETS } from '../../config/assets'
import { useMarketActions } from '../../store/useMarketStore'
import type { AssetClass } from '../../types/market'
import { WatchlistItem } from './WatchlistItem'

const GROUPS: { key: AssetClass; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { key: 'commodity', label: 'Emtia', icon: Gem },
  { key: 'crypto', label: 'Kripto', icon: Coins },
  { key: 'equity', label: 'S&P 500', icon: Landmark },
]

export const Watchlist = memo(function Watchlist() {
  // `actions` is a stable reference, so `selectAsset` never changes identity.
  const { selectAsset } = useMarketActions()
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)

  const groups = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase()
    const matches = q
      ? ASSETS.filter((a) => a.displaySymbol.toLowerCase().includes(q) || a.name.toLowerCase().includes(q))
      : ASSETS
    return GROUPS.map((g) => ({ ...g, ids: matches.filter((a) => a.assetClass === g.key).map((a) => a.id) })).filter(
      (g) => g.ids.length,
    )
  }, [deferredQuery])

  return (
    <aside className="flex h-full min-h-0 flex-col border-line bg-panel lg:border-r">
      <div className="border-b border-line p-3">
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">İzleme Listesi</h2>
        <label className="flex items-center gap-2 rounded-md border border-line bg-bg px-2.5 py-1.5 focus-within:border-accent">
          <Search className="size-3.5 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Varlık ara…"
            className="w-full bg-transparent text-base text-fg placeholder:text-muted focus:outline-none sm:text-xs"
          />
        </label>
      </div>

      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {groups.map(({ key, label, icon: Icon, ids }) => (
          <section key={key}>
            <h3 className="sticky top-0 z-10 flex items-center gap-1.5 border-b border-line/60 bg-panel/95 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted backdrop-blur">
              <Icon className="size-3" /> {label}
            </h3>
            <ul>
              {ids.map((id) => (
                <WatchlistItem key={id} id={id} onSelect={selectAsset} />
              ))}
            </ul>
          </section>
        ))}
        {!groups.length && <p className="p-4 text-center text-xs text-muted">Sonuç bulunamadı</p>}
      </div>
    </aside>
  )
})
