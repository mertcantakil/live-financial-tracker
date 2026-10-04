import { LoaderCircle, RefreshCw, TriangleAlert } from 'lucide-react'
import { memo } from 'react'

export const PanelLoading = memo(function PanelLoading({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center gap-2 text-xs text-muted">
      <LoaderCircle className="size-4 animate-spin text-accent" />
      {label}
    </div>
  )
})

export const PanelError = memo(function PanelError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <TriangleAlert className="size-6 text-warn" />
      <p className="text-xs text-muted">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 rounded-md border border-line bg-panel-2 px-3 py-1.5 text-xs text-fg transition hover:border-accent hover:text-accent"
      >
        <RefreshCw className="size-3.5" /> Tekrar dene
      </button>
    </div>
  )
})
