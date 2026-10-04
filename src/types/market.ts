export type AssetClass = 'crypto' | 'commodity' | 'equity'

/** Which upstream provides live quotes for the asset. */
export type QuoteSource = 'binance' | 'awesome' | 'yahoo'

export interface AssetDefinition {
  /** Internal id, also used as the store key (e.g. "BTC", "AAPL"). */
  id: string
  name: string
  displaySymbol: string
  assetClass: AssetClass
  quoteSource: QuoteSource
  /** Binance pair, e.g. "BTCUSDT". */
  binanceSymbol?: string
  /** Yahoo Finance ticker used for candles / quotes / news (e.g. "GC=F", "AAPL"). */
  yahooSymbol: string
  /** AwesomeAPI pair, e.g. "XAU-USD". */
  awesomePair?: string
  /** Google News search query for Turkish-language coverage. */
  newsQueryTr: string
  pricePrecision: number
}

export type NewsLanguage = 'tr' | 'en'

export type MobileView = 'markets' | 'chart' | 'news'

export type Timeframe = '1m' | '15m' | '1h' | '1D' | '1W'

export interface Candle {
  /** UNIX seconds (UTC). */
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export type PriceDirection = 'up' | 'down' | 'flat'

export interface Quote {
  id: string
  price: number
  /** Reference price for the daily change (previous close / 24h open). */
  reference: number
  change: number
  changePct: number
  /** Direction of the last tick relative to the previous one. */
  tickDirection: PriceDirection
  /** Volume traded since the previous quote update (streamed assets only). */
  tickVolume: number
  /** UNIX milliseconds of the last trade / quote. */
  updatedAt: number
}

/** Partial tick produced by any feed before it is merged into a Quote. */
export interface PriceTick {
  id: string
  price: number
  timestamp: number
  reference?: number
  /** Trade volume carried by the tick (crypto trades only). */
  volume?: number
}

export interface NewsItem {
  id: string
  title: string
  url: string
  source: string
  publishedAt: number
  summary?: string
  imageUrl?: string
}

export interface NewsFeed {
  items: NewsItem[]
  /** Language actually served (may differ from the requested one after a fallback). */
  language: NewsLanguage
}

export type FeedId = 'binance-ws' | 'gold' | 'equities'

export type ConnectionStatus = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'error'

export interface FeedState {
  status: ConnectionStatus
  lastError?: string
  /** Epoch ms when the next reconnect attempt is scheduled. */
  retryAt?: number
  attempt: number
}
