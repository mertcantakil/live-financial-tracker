const priceFormatters = new Map<number, Intl.NumberFormat>()

export const formatPrice = (value: number | undefined, precision = 2): string => {
  if (value === undefined || !Number.isFinite(value)) return '—'
  let fmt = priceFormatters.get(precision)
  if (!fmt) {
    fmt = new Intl.NumberFormat('en-US', { minimumFractionDigits: precision, maximumFractionDigits: precision })
    priceFormatters.set(precision, fmt)
  }
  return fmt.format(value)
}

const pctFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: 'always',
})

export const formatPercent = (value: number | undefined): string =>
  value === undefined || !Number.isFinite(value) ? '—' : `${pctFormatter.format(value)}%`

const compactFormatter = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 })

export const formatCompact = (value: number): string => compactFormatter.format(value)

const relativeFormatter = new Intl.RelativeTimeFormat('tr', { numeric: 'auto', style: 'short' })

export const formatRelativeTime = (epochMs: number, now = Date.now()): string => {
  const diffSec = Math.round((epochMs - now) / 1_000)
  const abs = Math.abs(diffSec)
  if (abs < 60) return relativeFormatter.format(diffSec, 'second')
  if (abs < 3_600) return relativeFormatter.format(Math.round(diffSec / 60), 'minute')
  if (abs < 86_400) return relativeFormatter.format(Math.round(diffSec / 3_600), 'hour')
  return relativeFormatter.format(Math.round(diffSec / 86_400), 'day')
}

export const cn = (...classes: (string | false | null | undefined)[]): string => classes.filter(Boolean).join(' ')
