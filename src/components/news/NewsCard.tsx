import { ExternalLink } from 'lucide-react'
import { memo } from 'react'
import { formatRelativeTime } from '../../lib/format'
import type { NewsItem } from '../../types/market'

export const NewsCard = memo(function NewsCard({ item, now }: { item: NewsItem; now: number }) {
  return (
    <li>
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className="group block border-b border-line/60 px-4 py-3 transition-colors hover:bg-panel-2"
      >
        <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted">
          <span className="font-semibold text-accent/90">{item.source}</span>
          <span>·</span>
          <time dateTime={new Date(item.publishedAt).toISOString()}>{formatRelativeTime(item.publishedAt, now)}</time>
          <ExternalLink className="ml-auto size-3 opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
        <h3 className="line-clamp-2 text-[13px] font-medium leading-snug text-fg group-hover:text-accent">{item.title}</h3>
        {item.summary && <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">{item.summary}</p>}
      </a>
    </li>
  )
})
