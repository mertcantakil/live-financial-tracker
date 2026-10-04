import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { describeError, isAbortError } from '../services/http'

interface CacheEntry {
  data: unknown
  fetchedAt: number
}

const cache = new Map<string, CacheEntry>()

export interface ResourceState<T> {
  data: T | undefined
  error: string | undefined
  loading: boolean
  reload: () => void
}

interface Options {
  /** Cached data younger than this is served without a network request. */
  ttlMs?: number
  /** Background refresh interval while mounted (skipped while the tab is hidden). */
  refreshMs?: number
}

/**
 * Keyed async loader with an in-memory cache, request cancellation on key change
 * and optional background refresh. Previous data stays visible while refreshing.
 */
export function useAsyncResource<T>(
  key: string,
  fetcher: (signal: AbortSignal) => Promise<T>,
  { ttlMs = 30_000, refreshMs }: Options = {},
): ResourceState<T> {
  const fetcherRef = useRef(fetcher)
  useLayoutEffect(() => {
    fetcherRef.current = fetcher
  })

  const [state, setState] = useState<{ key: string; data?: T; error?: string; loading: boolean }>(() => ({
    key,
    data: cache.get(key)?.data as T | undefined,
    loading: !cache.has(key),
  }))
  const [nonce, setNonce] = useState(0)
  const forceRef = useRef(false)

  // Reset synchronously on key change so stale data from another asset never flashes.
  if (state.key !== key) {
    const cached = cache.get(key)
    setState({ key, data: cached?.data as T | undefined, loading: !cached })
  }

  useEffect(() => {
    let controller: AbortController | null = null
    let timer: ReturnType<typeof setInterval> | undefined

    const load = async (force: boolean) => {
      const cached = cache.get(key)
      if (!force && cached && Date.now() - cached.fetchedAt < ttlMs) {
        setState({ key, data: cached.data as T, loading: false })
        return
      }
      controller?.abort()
      controller = new AbortController()
      setState((s) => ({ ...s, key, loading: true, error: undefined }))
      try {
        const data = await fetcherRef.current(controller.signal)
        cache.set(key, { data, fetchedAt: Date.now() })
        setState({ key, data, loading: false })
      } catch (err) {
        if (isAbortError(err)) return
        setState((s) => ({ ...s, key, loading: false, error: describeError(err) }))
      }
    }

    void load(forceRef.current)
    forceRef.current = false
    if (refreshMs) {
      timer = setInterval(() => {
        if (!document.hidden) void load(true)
      }, refreshMs)
    }

    return () => {
      controller?.abort()
      clearInterval(timer)
    }
  }, [key, ttlMs, refreshMs, nonce])

  const reload = useCallback(() => {
    forceRef.current = true
    setNonce((n) => n + 1)
  }, [])

  return { data: state.data, error: state.error, loading: state.loading, reload }
}
