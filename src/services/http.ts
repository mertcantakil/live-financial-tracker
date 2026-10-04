export type ApiErrorKind = 'network' | 'timeout' | 'rate-limit' | 'http' | 'parse' | 'aborted'

export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status?: number
  /** Server-suggested wait before retrying (ms), from `Retry-After`. */
  readonly retryAfterMs?: number

  constructor(kind: ApiErrorKind, message: string, opts: { status?: number; retryAfterMs?: number; cause?: unknown } = {}) {
    super(message, { cause: opts.cause })
    this.name = 'ApiError'
    this.kind = kind
    this.status = opts.status
    this.retryAfterMs = opts.retryAfterMs
  }

  get retryable(): boolean {
    if (this.kind === 'aborted' || this.kind === 'parse') return false
    if (this.kind === 'http') return this.status !== undefined && this.status >= 500
    return true
  }
}

export const isAbortError = (err: unknown): boolean =>
  (err instanceof ApiError && err.kind === 'aborted') ||
  (err instanceof DOMException && err.name === 'AbortError')

export const describeError = (err: unknown): string => {
  if (err instanceof ApiError) {
    switch (err.kind) {
      case 'rate-limit':
        return 'API istek limiti aşıldı'
      case 'network':
        return 'Ağ bağlantısı kurulamadı'
      case 'timeout':
        return 'Sunucu zaman aşımına uğradı'
      case 'http':
        return `Sunucu hatası (${err.status})`
      case 'parse':
        return 'Beklenmeyen veri formatı'
      default:
        return err.message
    }
  }
  return err instanceof Error ? err.message : 'Bilinmeyen hata'
}

/** Exponential backoff with full jitter, capped. */
export const backoffDelay = (attempt: number, baseMs = 1_000, maxMs = 30_000): number => {
  const exp = Math.min(maxMs, baseMs * 2 ** attempt)
  return Math.round(exp / 2 + Math.random() * (exp / 2))
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new ApiError('aborted', 'Aborted'))
    const t = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t)
        reject(new ApiError('aborted', 'Aborted'))
      },
      { once: true },
    )
  })

const parseRetryAfter = (header: string | null): number | undefined => {
  if (!header) return undefined
  const seconds = Number(header)
  if (Number.isFinite(seconds)) return seconds * 1_000
  const date = Date.parse(header)
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : undefined
}

export interface RequestOptions {
  signal?: AbortSignal
  timeoutMs?: number
  retries?: number
  headers?: Record<string, string>
}

async function requestOnce(url: string, { signal, timeoutMs = 10_000, headers }: RequestOptions): Promise<Response> {
  const timeoutSignal = AbortSignal.timeout(timeoutMs)
  const combined = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal

  let res: Response
  try {
    res = await fetch(url, { signal: combined, headers })
  } catch (err) {
    if (signal?.aborted) throw new ApiError('aborted', 'Aborted', { cause: err })
    if (timeoutSignal.aborted) throw new ApiError('timeout', `Timeout after ${timeoutMs}ms`, { cause: err })
    throw new ApiError('network', 'Network request failed', { cause: err })
  }

  if (res.status === 429 || res.status === 418) {
    throw new ApiError('rate-limit', 'Rate limit exceeded', {
      status: res.status,
      retryAfterMs: parseRetryAfter(res.headers.get('Retry-After')),
    })
  }
  if (!res.ok) throw new ApiError('http', `HTTP ${res.status}`, { status: res.status })
  return res
}

async function request(url: string, opts: RequestOptions = {}): Promise<Response> {
  const retries = opts.retries ?? 2
  for (let attempt = 0; ; attempt++) {
    try {
      return await requestOnce(url, opts)
    } catch (err) {
      const apiErr = err instanceof ApiError ? err : new ApiError('network', String(err), { cause: err })
      if (!apiErr.retryable || attempt >= retries) throw apiErr
      await sleep(apiErr.retryAfterMs ?? backoffDelay(attempt, 500, 8_000), opts.signal)
    }
  }
}

export async function getJson<T>(url: string, opts?: RequestOptions): Promise<T> {
  const res = await request(url, opts)
  try {
    return (await res.json()) as T
  } catch (err) {
    throw new ApiError('parse', 'Invalid JSON response', { cause: err })
  }
}

export async function getText(url: string, opts?: RequestOptions): Promise<string> {
  const res = await request(url, opts)
  return res.text()
}

export const buildUrl = (base: string, params: Record<string, string | number | undefined>): string => {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined) qs.set(k, String(v))
  const query = qs.toString()
  return query ? `${base}?${query}` : base
}
