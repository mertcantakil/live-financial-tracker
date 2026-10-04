/**
 * Same-origin proxy for upstreams without CORS support (Yahoo Finance, Google News).
 * `vercel.json` rewrites `/api/<route>/<path>` to `/api/proxy?__path=<route>/<path>`.
 *
 * Only allow-listed paths are forwarded, so this cannot be used as an open proxy.
 * `ttl` (seconds) is sent as `s-maxage`, so the Vercel CDN answers repeat requests
 * without invoking the function.
 */

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'

interface Route {
  prefix: string
  origin: string
  allow: RegExp
  ttl: number
}

const ROUTES: Route[] = [
  { prefix: 'yahoo-rss/', origin: 'https://feeds.finance.yahoo.com', allow: /^\/rss\/2\.0\/headline$/, ttl: 300 },
  { prefix: 'yahoo/', origin: 'https://query1.finance.yahoo.com', allow: /^\/v8\/finance\/(chart\/[^/]+|spark)$/, ttl: 15 },
  { prefix: 'gnews/', origin: 'https://news.google.com', allow: /^\/rss\/search$/, ttl: 300 },
]

interface CacheEntry {
  status: number
  body: ArrayBuffer
  contentType: string
  expiresAt: number
}

const MAX_CACHE_ENTRIES = 200
/** Warm-instance cache; also used to serve stale data when an upstream fails. */
const cache = new Map<string, CacheEntry>()

const remember = (key: string, entry: CacheEntry) => {
  if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value as string)
  cache.set(key, entry)
}

const respond = (entry: CacheEntry, ttl: number, state: 'HIT' | 'MISS' | 'STALE') =>
  new Response(entry.body, {
    status: entry.status,
    headers: {
      'Content-Type': entry.contentType,
      'Cache-Control': `public, max-age=${ttl}, s-maxage=${ttl}, stale-while-revalidate=${ttl * 4}`,
      'X-Proxy-Cache': state,
    },
  })

const error = (status: number, message: string, extra: Record<string, string> = {}) =>
  new Response(message, { status, headers: { 'Cache-Control': 'no-store', ...extra } })

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const routedPath = url.searchParams.get('__path') ?? ''
  url.searchParams.delete('__path')

  const route = ROUTES.find((r) => routedPath.startsWith(r.prefix))
  const upstreamPath = route ? `/${routedPath.slice(route.prefix.length)}` : ''
  if (!route || !route.allow.test(upstreamPath)) return error(404, 'Not Found')

  const query = url.searchParams.toString()
  const target = `${route.origin}${upstreamPath}${query ? `?${query}` : ''}`

  const cached = cache.get(target)
  if (cached && cached.expiresAt > Date.now()) return respond(cached, route.ttl, 'HIT')

  try {
    const upstream = await fetch(target, {
      headers: { 'User-Agent': BROWSER_UA, Accept: '*/*' },
      signal: AbortSignal.timeout(10_000),
    })
    const entry: CacheEntry = {
      status: upstream.status,
      body: await upstream.arrayBuffer(),
      contentType: upstream.headers.get('content-type') ?? 'application/octet-stream',
      expiresAt: Date.now() + route.ttl * 1_000,
    }

    if (upstream.ok) {
      remember(target, entry)
      return respond(entry, route.ttl, 'MISS')
    }
    if (cached) return respond(cached, route.ttl, 'STALE')
    return error(upstream.status, `Upstream responded ${upstream.status}`, upstream.status === 429 ? { 'Retry-After': '30' } : {})
  } catch (err) {
    console.warn('Upstream request failed', target, String(err))
    if (cached) return respond(cached, route.ttl, 'STALE')
    return error(502, 'Bad Gateway')
  }
}
