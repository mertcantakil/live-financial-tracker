import { Info, Newspaper, RefreshCw } from 'lucide-react'
import { memo, useEffect, useState } from 'react'
import { useNews } from '../../hooks/useNews'
import { cn } from '../../lib/format'
import { useMarketActions, useNewsLanguage, useSelectedAsset } from '../../store/useMarketStore'
import type { NewsLanguage } from '../../types/market'
import { PanelError } from '../common/PanelState'
import { NewsCard } from './NewsCard'

const LANGUAGES: { id: NewsLanguage; label: string }[] = [
  { id: 'tr', label: 'TR' },
  { id: 'en', label: 'EN' },
]

function NewsSkeleton() {
  return (
    <ul aria-hidden>
      {Array.from({ length: 6 }, (_, i) => (
        <li key={i} className="space-y-2 border-b border-line/60 px-4 py-3">
          <div className="skeleton h-2.5 w-24" />
          <div className="skeleton h-3.5 w-full" />
          <div className="skeleton h-3.5 w-3/4" />
        </li>
      ))}
    </ul>
  )
}

/** Refreshes relative timestamps once a minute without refetching. */
function useMinuteClock(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [])
  return now
}

const LanguageToggle = memo(function LanguageToggle() {
  const language = useNewsLanguage()
  const { setNewsLanguage } = useMarketActions()
  return (
    <div role="radiogroup" aria-label="Haber dili" className="flex rounded-md border border-line bg-bg p-0.5">
      {LANGUAGES.map((l) => (
        <button
          key={l.id}
          type="button"
          role="radio"
          aria-checked={l.id === language}
          onClick={() => setNewsLanguage(l.id)}
          className={cn(
            'min-w-9 rounded px-2 py-1 text-[11px] font-semibold transition-colors max-lg:py-1.5',
            l.id === language ? 'bg-accent text-white' : 'text-muted hover:text-fg',
          )}
        >
          {l.label}
        </button>
      ))}
    </div>
  )
})

export const NewsPanel = memo(function NewsPanel() {
  const asset = useSelectedAsset()
  const language = useNewsLanguage()
  const { data, error, loading, reload } = useNews(asset, language)
  const now = useMinuteClock()
  const items = data?.items
  const fellBack = data && language === 'tr' && data.language === 'en'

  return (
    <aside className="flex h-full min-h-0 flex-col border-line bg-panel lg:border-l">
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
        <h2 className="flex min-w-0 items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
          <Newspaper className="size-3.5 shrink-0" />
          <span className="truncate">
            Haberler · <span className="text-fg">{asset.displaySymbol}</span>
          </span>
        </h2>
        <div className="flex items-center gap-1.5">
          <LanguageToggle />
          <button
            type="button"
            onClick={reload}
            disabled={loading}
            aria-label="Haberleri yenile"
            className="rounded p-1.5 text-muted transition hover:bg-panel-2 hover:text-fg disabled:opacity-50"
          >
            <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {fellBack && (
        <p className="flex items-center gap-1.5 border-b border-line bg-warn/5 px-4 py-2 text-[11px] text-warn">
          <Info className="size-3.5 shrink-0" />
          Yeterli Türkçe haber bulunamadı, İngilizce kaynaklar gösteriliyor.
        </p>
      )}

      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {!items && loading && <NewsSkeleton />}
        {!items && error && <PanelError message={`Haberler alınamadı: ${error}`} onRetry={reload} />}
        {items && items.length === 0 && (
          <p className="p-6 text-center text-xs text-muted">Bu varlık için güncel haber bulunamadı.</p>
        )}
        {items && items.length > 0 && (
          <ul>
            {items.map((item) => (
              <NewsCard key={item.id} item={item} now={now} />
            ))}
          </ul>
        )}
      </div>
    </aside>
  )
})
