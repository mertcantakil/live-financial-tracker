import { setGlobalOptions } from 'firebase-functions/v2'
import { onRequest } from 'firebase-functions/v2/https'
import { logger } from 'firebase-functions'

setGlobalOptions({ region: 'europe-west1', maxInstances: 5, memory: '256MiB', timeoutSeconds: 20 })

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'

/**
 * Allow-listed upstreams. Only these exact paths can be proxied, so the
 * function cannot be abused as an open proxy. `ttl` is in seconds and is also
 * sent as `s-maxage`, letting the Firebase Hosting CDN absorb most traffic.
 */
const ROUTES = [
  { prefix: '/api/yahoo-rss/', origin: 'https://feeds.finance.yahoo.com', allow: /^\/rss\/2\.0\/headline$/, ttl: 300 },
  { prefix: '/api/yahoo/', origin: 'https://query1.finance.yahoo.com', allow: /^\/v8\/finance\/(chart\/[^/]+|spark)$/, ttl: 15 },
  { prefix: '/api/gnews/', origin: 'https://news.google.com', allow: /^\/rss\/search$/, ttl: 300 },
]

const MAX_CACHE_ENTRIES = 300
/** @type {Map<string, { status: number, body: Buffer, contentType: string, expiresAt: number }>} */
const cache = new Map()

const remember = (key, entry) => {
  if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value)
  cache.set(key, entry)
}

export const api = onRequest(async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).send('Method Not Allowed')
    return
  }

  const incoming = new URL(req.originalUrl, 'http://localhost')
  const route = ROUTES.find((r) => incoming.pathname.startsWith(r.prefix))
  const upstreamPath = route ? incoming.pathname.slice(route.prefix.length - 1) : ''
  if (!route || !route.allow.test(upstreamPath)) {
    res.status(404).send('Not Found')
    return
  }

  const target = `${route.origin}${upstreamPath}${incoming.search}`
  const send = (entry, cacheState) => {
    res.set('Content-Type', entry.contentType)
    res.set('Cache-Control', `public, max-age=${route.ttl}, s-maxage=${route.ttl}`)
    res.set('X-Proxy-Cache', cacheState)
    res.status(entry.status).send(entry.body)
  }

  const cached = cache.get(target)
  if (cached && cached.expiresAt > Date.now()) {
    send(cached, 'HIT')
    return
  }

  try {
    const upstream = await fetch(target, {
      headers: { 'User-Agent': BROWSER_UA, Accept: '*/*' },
      signal: AbortSignal.timeout(10_000),
    })
    const entry = {
      status: upstream.status,
      body: Buffer.from(await upstream.arrayBuffer()),
      contentType: upstream.headers.get('content-type') ?? 'application/octet-stream',
      expiresAt: Date.now() + route.ttl * 1_000,
    }

    if (upstream.ok) {
      remember(target, entry)
      send(entry, 'MISS')
      return
    }
    // Serve stale data instead of propagating upstream rate limits / outages.
    if (cached) {
      send(cached, 'STALE')
      return
    }
    if (upstream.status === 429) res.set('Retry-After', '30')
    res.set('Cache-Control', 'no-store')
    res.status(upstream.status).send(entry.body)
  } catch (err) {
    logger.warn('Upstream request failed', { target, error: String(err) })
    if (cached) {
      send(cached, 'STALE')
      return
    }
    res.set('Cache-Control', 'no-store')
    res.status(502).send('Bad Gateway')
  }
})
