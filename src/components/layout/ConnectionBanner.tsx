import { RefreshCw, WifiOff } from 'lucide-react'
import { memo, useEffect, useState, useSyncExternalStore } from 'react'
import { useFeeds } from '../../store/useMarketStore'
import type { FeedId } from '../../types/market'

const FEED_LABEL: Record<FeedId, string> = {
  'binance-ws': 'Kripto akışı',
  gold: 'Altın verisi',
  equities: 'Hisse verisi',
}

const subscribeOnline = (cb: () => void) => {
  window.addEventListener('online', cb)
  window.addEventListener('offline', cb)
  return () => {
    window.removeEventListener('online', cb)
    window.removeEventListener('offline', cb)
  }
}

function Countdown({ until }: { until: number }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [until])
  const sec = Math.max(0, Math.ceil((until - now) / 1_000))
  return <span className="tabular-nums">{sec > 0 ? `${sec} sn` : 'şimdi'}</span>
}

/** Floating toast shown only while at least one feed is degraded or the browser is offline. */
export const ConnectionBanner = memo(function ConnectionBanner() {
  const feeds = useFeeds()
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine)

  const degraded = (Object.keys(feeds) as FeedId[])
    .map((id) => ({ id, ...feeds[id] }))
    .filter((f) => f.status === 'reconnecting' || f.status === 'error')

  if (online && degraded.length === 0) return null

  const nextRetry = degraded.reduce<number | undefined>(
    (min, f) => (f.retryAt && (!min || f.retryAt < min) ? f.retryAt : min),
    undefined,
  )

  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-3 lg:bottom-4 lg:px-4">
      <div className="toast-in pointer-events-auto flex max-w-lg items-start gap-3 rounded-lg border border-warn/40 bg-panel/95 px-4 py-3 shadow-2xl shadow-black/50 backdrop-blur">
        {online ? (
          <RefreshCw className="mt-0.5 size-4 shrink-0 animate-spin text-warn" />
        ) : (
          <WifiOff className="mt-0.5 size-4 shrink-0 text-down" />
        )}
        <div className="text-xs">
          <p className="font-medium text-fg">{online ? 'Yeniden bağlanılıyor…' : 'İnternet bağlantısı yok'}</p>
          <p className="mt-0.5 text-muted">
            {online
              ? degraded.map((f) => `${FEED_LABEL[f.id]}${f.lastError ? ` (${f.lastError})` : ''}`).join(' · ')
              : 'Bağlantı geri geldiğinde veriler otomatik olarak yenilenecek.'}
          </p>
          {online && nextRetry && (
            <p className="mt-1 text-muted">
              Sonraki deneme: <Countdown until={nextRetry} />
            </p>
          )}
        </div>
      </div>
    </div>
  )
})
