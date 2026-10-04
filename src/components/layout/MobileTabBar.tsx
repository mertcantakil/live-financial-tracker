import { ChartCandlestick, List, Newspaper } from 'lucide-react'
import { memo, type ComponentType } from 'react'
import { cn } from '../../lib/format'
import { useMarketActions, useMobileView } from '../../store/useMarketStore'
import type { MobileView } from '../../types/market'

const TABS: { id: MobileView; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { id: 'markets', label: 'Piyasalar', icon: List },
  { id: 'chart', label: 'Grafik', icon: ChartCandlestick },
  { id: 'news', label: 'Haberler', icon: Newspaper },
]

/** Bottom navigation shown below the `lg` breakpoint. */
export const MobileTabBar = memo(function MobileTabBar() {
  const view = useMobileView()
  const { setMobileView } = useMarketActions()

  return (
    <nav
      aria-label="Bölümler"
      className="grid shrink-0 grid-cols-3 border-t border-line bg-panel pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      {TABS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => setMobileView(id)}
          aria-current={view === id ? 'page' : undefined}
          className={cn(
            'flex h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
            view === id ? 'text-accent' : 'text-muted active:text-fg',
          )}
        >
          <Icon className="size-5" />
          {label}
        </button>
      ))}
    </nav>
  )
})
