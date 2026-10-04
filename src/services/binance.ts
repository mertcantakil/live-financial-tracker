import type { Candle, ConnectionStatus, PriceTick, Timeframe } from '../types/market'
import { backoffDelay, buildUrl, getJson, type RequestOptions } from './http'

const REST_BASE = 'https://api.binance.com/api/v3'
const WS_BASE = 'wss://stream.binance.com:9443'

const INTERVAL: Record<Timeframe, string> = {
  '1m': '1m',
  '15m': '15m',
  '1h': '1h',
  '1D': '1d',
  '1W': '1w',
}

/** [openTime, open, high, low, close, volume, closeTime, quoteVolume, trades, takerBase, takerQuote, ignore] */
type RawKline = [number, string, string, string, string, string, number, string, number, string, string, string]

export async function fetchBinanceKlines(
  symbol: string,
  timeframe: Timeframe,
  opts: RequestOptions & { limit?: number } = {},
): Promise<Candle[]> {
  const url = buildUrl(`${REST_BASE}/klines`, {
    symbol,
    interval: INTERVAL[timeframe],
    limit: opts.limit ?? 500,
  })
  const rows = await getJson<RawKline[]>(url, opts)
  return rows.map((k) => ({
    time: Math.floor(k[0] / 1_000),
    open: +k[1],
    high: +k[2],
    low: +k[3],
    close: +k[4],
    volume: +k[5],
  }))
}

interface Raw24hTicker {
  symbol: string
  lastPrice: string
  openPrice: string
  closeTime: number
}

/** Rolling 24h stats used as the reference price for % change. */
export async function fetchBinance24h(symbols: string[], opts?: RequestOptions) {
  const url = buildUrl(`${REST_BASE}/ticker/24hr`, { symbols: JSON.stringify(symbols) })
  const rows = await getJson<Raw24hTicker[]>(url, opts)
  return rows.map((r) => ({
    symbol: r.symbol,
    price: +r.lastPrice,
    open24h: +r.openPrice,
    timestamp: r.closeTime,
  }))
}

interface TradeEvent {
  e: 'trade'
  E: number
  s: string
  p: string
  q: string
  T: number
}

interface CombinedMessage {
  stream: string
  data: TradeEvent
}

export interface BinanceStreamHandlers {
  /** symbol → internal asset id. */
  symbolToId: Record<string, string>
  onTick: (tick: PriceTick) => void
  onStatus: (status: ConnectionStatus, info?: { attempt: number; retryAt?: number; error?: string }) => void
}

/**
 * Resilient combined trade stream (`<symbol>@trade`) with:
 * - exponential backoff + jitter reconnects
 * - heartbeat watchdog (reconnects if no message for `staleMs`)
 * - pause while the browser is offline, immediate retry once back online
 */
export class BinanceTradeStream {
  private ws: WebSocket | null = null
  private attempt = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined
  private watchdog: ReturnType<typeof setInterval> | undefined
  private lastMessageAt = 0
  private closedByUser = false
  private readonly symbols: string[]
  private readonly handlers: BinanceStreamHandlers
  private readonly staleMs: number

  constructor(symbols: string[], handlers: BinanceStreamHandlers, staleMs = 15_000) {
    this.symbols = symbols
    this.handlers = handlers
    this.staleMs = staleMs
  }

  start(): void {
    this.closedByUser = false
    window.addEventListener('online', this.handleOnline)
    window.addEventListener('offline', this.handleOffline)
    this.connect()
  }

  stop(): void {
    this.closedByUser = true
    window.removeEventListener('online', this.handleOnline)
    window.removeEventListener('offline', this.handleOffline)
    clearTimeout(this.reconnectTimer)
    clearInterval(this.watchdog)
    this.teardownSocket()
    this.handlers.onStatus('idle', { attempt: 0 })
  }

  private connect(): void {
    if (this.closedByUser) return
    if (!navigator.onLine) {
      this.handlers.onStatus('reconnecting', { attempt: this.attempt, error: 'Çevrimdışı' })
      return
    }

    this.teardownSocket()
    this.handlers.onStatus(this.attempt === 0 ? 'connecting' : 'reconnecting', { attempt: this.attempt })

    const streams = this.symbols.map((s) => `${s.toLowerCase()}@trade`).join('/')
    const ws = new WebSocket(`${WS_BASE}/stream?streams=${streams}`)
    this.ws = ws

    ws.onopen = () => {
      this.attempt = 0
      this.lastMessageAt = Date.now()
      this.handlers.onStatus('open', { attempt: 0 })
      clearInterval(this.watchdog)
      this.watchdog = setInterval(() => {
        if (Date.now() - this.lastMessageAt > this.staleMs) this.scheduleReconnect('Veri akışı durdu')
      }, this.staleMs / 3)
    }

    ws.onmessage = (ev: MessageEvent<string>) => {
      this.lastMessageAt = Date.now()
      let msg: CombinedMessage
      try {
        msg = JSON.parse(ev.data) as CombinedMessage
      } catch {
        return
      }
      const t = msg.data
      if (!t || t.e !== 'trade') return
      const id = this.handlers.symbolToId[t.s]
      if (!id) return
      this.handlers.onTick({ id, price: +t.p, volume: +t.q, timestamp: t.T })
    }

    ws.onerror = () => {
      // `onclose` always follows; reconnect is handled there.
    }

    ws.onclose = (ev) => {
      if (this.ws !== ws || this.closedByUser) return
      this.scheduleReconnect(ev.reason || `Bağlantı kapandı (${ev.code})`)
    }
  }

  private scheduleReconnect(error: string): void {
    if (this.closedByUser) return
    clearInterval(this.watchdog)
    clearTimeout(this.reconnectTimer)
    this.teardownSocket()

    const delay = backoffDelay(this.attempt)
    this.attempt += 1
    this.handlers.onStatus('reconnecting', { attempt: this.attempt, retryAt: Date.now() + delay, error })
    this.reconnectTimer = setTimeout(() => this.connect(), delay)
  }

  private teardownSocket(): void {
    const ws = this.ws
    if (!ws) return
    this.ws = null
    ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) ws.close()
  }

  private handleOnline = () => {
    clearTimeout(this.reconnectTimer)
    this.attempt = 0
    this.connect()
  }

  private handleOffline = () => {
    clearInterval(this.watchdog)
    clearTimeout(this.reconnectTimer)
    this.teardownSocket()
    this.handlers.onStatus('reconnecting', { attempt: this.attempt, error: 'Çevrimdışı' })
  }
}
