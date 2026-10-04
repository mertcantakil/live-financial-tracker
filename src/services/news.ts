import type { AssetDefinition, NewsFeed, NewsItem, NewsLanguage } from '../types/market'
import { API_BASE } from './apiBase'
import { ApiError, buildUrl, getJson, getText, type RequestOptions } from './http'

const FINNHUB_KEY: string | undefined = import.meta.env.VITE_FINNHUB_API_KEY || undefined

/** Below this many Turkish headlines the feed falls back to English sources. */
const MIN_TR_ITEMS = 3

const stripHtml = (html: string): string => {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return (doc.body.textContent ?? '').trim()
}

const parseRss = (xml: string): Element[] => {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.querySelector('parsererror')) throw new ApiError('parse', 'Invalid RSS document')
  return Array.from(doc.querySelectorAll('item'))
}

const textOf = (el: Element, sel: string) => el.querySelector(sel)?.textContent?.trim() ?? ''

async function fetchGoogleNewsTr(asset: AssetDefinition, opts?: RequestOptions): Promise<NewsItem[]> {
  const url = buildUrl(`${API_BASE}/gnews/rss/search`, {
    q: `${asset.newsQueryTr} when:7d`,
    hl: 'tr',
    gl: 'TR',
    ceid: 'TR:tr',
  })
  const items = parseRss(await getText(url, opts))

  return items.map((item, i) => {
    const source = textOf(item, 'source') || 'Google Haberler'
    const rawTitle = textOf(item, 'title')
    // Google appends " - <Source>" to every headline.
    const suffix = ` - ${source}`
    const title = rawTitle.endsWith(suffix) ? rawTitle.slice(0, -suffix.length) : rawTitle
    const link = textOf(item, 'link')
    return {
      id: textOf(item, 'guid') || link || `${asset.id}-tr-${i}`,
      title,
      url: link,
      source,
      publishedAt: Date.parse(textOf(item, 'pubDate')) || Date.now(),
    }
  })
}

async function fetchYahooRss(asset: AssetDefinition, opts?: RequestOptions): Promise<NewsItem[]> {
  const url = buildUrl(`${API_BASE}/yahoo-rss/rss/2.0/headline`, { s: asset.yahooSymbol, region: 'US', lang: 'en-US' })
  const items = parseRss(await getText(url, opts))

  return items.map((item, i) => {
    const link = textOf(item, 'link')
    const description = textOf(item, 'description')
    return {
      id: textOf(item, 'guid') || link || `${asset.id}-${i}`,
      title: textOf(item, 'title'),
      url: link,
      source: 'Yahoo Finance',
      publishedAt: Date.parse(textOf(item, 'pubDate')) || Date.now(),
      summary: description ? stripHtml(description) : undefined,
    }
  })
}

interface FinnhubArticle {
  id: number
  headline: string
  url: string
  source: string
  datetime: number
  summary: string
  image: string
}

async function fetchFinnhub(asset: AssetDefinition, token: string, opts?: RequestOptions): Promise<NewsItem[]> {
  const base = 'https://finnhub.io/api/v1'
  let url: string
  if (asset.assetClass === 'equity') {
    const to = new Date()
    const from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1_000)
    const day = (d: Date) => d.toISOString().slice(0, 10)
    url = buildUrl(`${base}/company-news`, { symbol: asset.yahooSymbol, from: day(from), to: day(to), token })
  } else {
    url = buildUrl(`${base}/news`, { category: asset.assetClass === 'crypto' ? 'crypto' : 'general', token })
  }

  const rows = await getJson<FinnhubArticle[]>(url, opts)
  const keyword = asset.assetClass === 'equity' ? null : new RegExp(`\\b(${asset.id}|${asset.name.split(' ')[0]})\\b`, 'i')
  const filtered = keyword ? rows.filter((r) => keyword.test(r.headline) || keyword.test(r.summary)) : rows

  return (filtered.length ? filtered : rows).map((r) => ({
    id: String(r.id),
    title: r.headline,
    url: r.url,
    source: r.source,
    publishedAt: r.datetime * 1_000,
    summary: r.summary || undefined,
    imageUrl: r.image || undefined,
  }))
}

async function fetchEnglish(asset: AssetDefinition, opts?: RequestOptions): Promise<NewsItem[]> {
  if (FINNHUB_KEY) {
    try {
      return await fetchFinnhub(asset, FINNHUB_KEY, opts)
    } catch (err) {
      if (opts?.signal?.aborted) throw err
    }
  }
  return fetchYahooRss(asset, opts)
}

const normalize = (items: NewsItem[], limit: number): NewsItem[] => {
  const seen = new Set<string>()
  return items
    .filter((n) => n.title && n.url && !seen.has(n.title) && seen.add(n.title))
    .sort((a, b) => b.publishedAt - a.publishedAt)
    .slice(0, limit)
}

/**
 * Turkish: Google News (TR) → English fallback when coverage is thin.
 * English: Finnhub (if an API key is configured) → Yahoo Finance RSS.
 */
export async function fetchNews(
  asset: AssetDefinition,
  language: NewsLanguage,
  opts?: RequestOptions & { limit?: number },
): Promise<NewsFeed> {
  const limit = opts?.limit ?? 30

  if (language === 'tr') {
    try {
      const items = normalize(await fetchGoogleNewsTr(asset, opts), limit)
      if (items.length >= MIN_TR_ITEMS) return { items, language: 'tr' }
    } catch (err) {
      if (opts?.signal?.aborted) throw err
    }
  }

  return { items: normalize(await fetchEnglish(asset, opts), limit), language: 'en' }
}
