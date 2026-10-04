import { ChartCandlestick, Clock } from 'lucide-react'
import { memo, useEffect, useState } from 'react'
import { cn } from '../../lib/format'
import { useFeeds } from '../../store/useMarketStore'
import type { ConnectionStatus, FeedId } from '../../types/market'

const FEEDS: { id: FeedId; label: string }[] = [
  { id: 'binance-ws', label: 'Binance WS' },
  { id: 'gold', label: 'XAU' },
  { id: 'equities', label: 'NYSE/NASDAQ' },
]

const DOT: Record<ConnectionStatus, string> = {
  idle: 'bg-muted',
  connecting: 'bg-warn animate-pulse',
  open: 'bg-up',
  reconnecting: 'bg-warn animate-pulse',
  error: 'bg-down',
}

const clockFmt = new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })

/** Isolated so the 1 Hz tick re-renders only this text node. */
const LiveClock = memo(function LiveClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1_000)
    return () => clearInterval(t)
  }, [])
  return <span className="font-mono tabular-nums">{clockFmt.format(now)}</span>
})

const FeedIndicators = memo(function FeedIndicators() {
  const feeds = useFeeds()
  return (
    <ul className="flex items-center gap-1.5 md:gap-4" aria-label="Veri akışları">
      {FEEDS.map((f) => (
        <li key={f.id} className="flex items-center gap-1.5 text-[11px] text-muted" title={`${f.label}: ${feeds[f.id].lastError ?? feeds[f.id].status}`}>
          <span className={cn('size-2 rounded-full md:size-1.5', DOT[feeds[f.id].status])} />
          <span className="max-md:sr-only">{f.label}</span>
        </li>
      ))}
    </ul>
  )
})

export const AppHeader = memo(function AppHeader() {
  return (
    <header className="flex h-11 shrink-0 items-center justify-between border-b border-line bg-panel px-3 pt-[env(safe-area-inset-top)] box-content sm:px-4">
      <div className="flex items-center gap-2">
        <ChartCandlestick className="size-5 text-accent" />
        <span className="text-sm font-semibold tracking-wide text-fg">
          LIVE<span className="text-accent">MARKET</span>
        </span>
        <span className="ml-2 hidden rounded border border-line px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted sm:inline">
          Terminal
        </span>
      </div>
      <div className="flex items-center gap-3 md:gap-6">
        <FeedIndicators />
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <Clock className="size-3.5" />
          <LiveClock />
        </div>
      </div>
    </header>
  )
})
