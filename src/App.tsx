import type { ReactNode } from 'react'
import { ChartPanel } from './components/chart/ChartPanel'
import { ErrorBoundary } from './components/common/ErrorBoundary'
import { AppHeader } from './components/layout/AppHeader'
import { ConnectionBanner } from './components/layout/ConnectionBanner'
import { MobileTabBar } from './components/layout/MobileTabBar'
import { NewsPanel } from './components/news/NewsPanel'
import { Watchlist } from './components/watchlist/Watchlist'
import { useMarketFeeds } from './hooks/useMarketFeeds'
import { cn } from './lib/format'
import { useMobileView } from './store/useMarketStore'
import type { MobileView } from './types/market'

/**
 * Below `lg` only the active panel is displayed; the others are hidden with CSS
 * (not unmounted) so the chart and fetched data survive tab switches.
 */
function Pane({ view, active, children }: { view: MobileView; active: MobileView; children: ReactNode }) {
  return <div className={cn('min-h-0 min-w-0', view !== active && 'max-lg:hidden')}>{children}</div>
}

/**
 * App shell. It only subscribes to the mobile tab, so live price updates
 * never re-render it; every tick is handled by the leaf component that owns the value.
 */
export default function App() {
  useMarketFeeds()
  const view = useMobileView()

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-bg text-fg">
      <AppHeader />
      <main className="grid min-h-0 flex-1 grid-cols-1 grid-rows-1 lg:grid-cols-[260px_minmax(0,1fr)_340px]">
        <Pane view="markets" active={view}>
          <ErrorBoundary label="İzleme listesi" className="bg-panel">
            <Watchlist />
          </ErrorBoundary>
        </Pane>
        <Pane view="chart" active={view}>
          <ErrorBoundary label="Grafik paneli">
            <ChartPanel />
          </ErrorBoundary>
        </Pane>
        <Pane view="news" active={view}>
          <ErrorBoundary label="Haber akışı" className="bg-panel">
            <NewsPanel />
          </ErrorBoundary>
        </Pane>
      </main>
      <MobileTabBar />
      <ConnectionBanner />
    </div>
  )
}
