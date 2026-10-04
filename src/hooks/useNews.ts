import { useCallback } from 'react'
import { POLL_INTERVALS } from '../config/assets'
import { fetchNews } from '../services/news'
import type { AssetDefinition, NewsFeed, NewsLanguage } from '../types/market'
import { useAsyncResource } from './useAsyncResource'

export function useNews(asset: AssetDefinition, language: NewsLanguage) {
  const fetcher = useCallback(
    (signal: AbortSignal) => fetchNews(asset, language, { signal, retries: 1 }),
    [asset, language],
  )
  return useAsyncResource<NewsFeed>(`news:${language}:${asset.id}`, fetcher, {
    ttlMs: POLL_INTERVALS.newsMs,
    refreshMs: POLL_INTERVALS.newsMs,
  })
}
