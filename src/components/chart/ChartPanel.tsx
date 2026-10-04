import { Radio } from 'lucide-react'
import { memo } from 'react'
import { useCandles } from '../../hooks/useCandles'
import { cn } from '../../lib/format'
import { candleSourceLabel, isStreamedAsset } from '../../services/marketData'
import { useSelectedAsset, useTimeframe } from '../../store/useMarketStore'
import { ErrorBoundary } from '../common/ErrorBoundary'
import { PanelError, PanelLoading } from '../common/PanelState'
import { AssetStrip } from './AssetStrip'
import { AssetTicker } from './AssetTicker'
import { CandlestickChart } from './CandlestickChart'
import { TimeframeSelector } from './TimeframeSelector'

export const ChartPanel = memo(function ChartPanel() {
  const asset = useSelectedAsset()
  const timeframe = useTimeframe()
  const { data, error, loading, reload } = useCandles(asset, timeframe)
  const streamed = isStreamedAsset(asset)

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col bg-bg">
      <AssetStrip />
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-line px-3 py-2.5 sm:px-4 sm:py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold text-fg">{asset.displaySymbol}</h1>
            <span className="hidden truncate text-xs text-muted sm:inline">{asset.name}</span>
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase',
                streamed ? 'border-up/30 bg-up/10 text-up' : 'border-warn/30 bg-warn/10 text-warn',
              )}
              title={streamed ? 'WebSocket canlı işlem akışı' : 'Periyodik güncelleme (15 sn)'}
            >
              <Radio className="size-3" /> {streamed ? 'Canlı' : 'Gecikmeli'}
            </span>
          </div>
          <AssetTicker asset={asset} />
        </div>
        <TimeframeSelector />
      </div>

      <div className="relative min-h-0 flex-1">
        <ErrorBoundary label="Grafik" resetKey={`${asset.id}:${timeframe}`}>
          <CandlestickChart asset={asset} timeframe={timeframe} candles={data} />
        </ErrorBoundary>

        {loading && !data && (
          <div className="absolute inset-0 z-20 bg-bg/80">
            <PanelLoading label="Mum verileri yükleniyor…" />
          </div>
        )}
        {error && !data && (
          <div className="absolute inset-0 z-20 bg-bg">
            <PanelError message={`Grafik verisi alınamadı: ${error}`} onRetry={reload} />
          </div>
        )}
        {loading && data && <div className="loading-bar absolute inset-x-0 top-0 z-20 h-0.5" />}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-1.5 text-[10px] text-muted sm:px-4">
        <span className="truncate">Kaynak: {candleSourceLabel(asset)}</span>
        {error && data && <span className="shrink-0 text-warn">Güncelleme başarısız — son veriler gösteriliyor</span>}
      </div>
    </section>
  )
})
