import type { AssetDefinition, Timeframe } from '../types/market'

export const ASSETS: readonly AssetDefinition[] = [
  {
    id: 'XAU',
    name: 'Altın / USD',
    displaySymbol: 'XAU/USD',
    assetClass: 'commodity',
    quoteSource: 'awesome',
    awesomePair: 'XAU-USD',
    yahooSymbol: 'GC=F',
    newsQueryTr: '"ons altın" OR "altın fiyatları"',
    pricePrecision: 2,
  },
  {
    id: 'BTC',
    name: 'Bitcoin',
    displaySymbol: 'BTC/USDT',
    assetClass: 'crypto',
    quoteSource: 'binance',
    binanceSymbol: 'BTCUSDT',
    yahooSymbol: 'BTC-USD',
    newsQueryTr: 'Bitcoin',
    pricePrecision: 2,
  },
  {
    id: 'ETH',
    name: 'Ethereum',
    displaySymbol: 'ETH/USDT',
    assetClass: 'crypto',
    quoteSource: 'binance',
    binanceSymbol: 'ETHUSDT',
    yahooSymbol: 'ETH-USD',
    newsQueryTr: 'Ethereum',
    pricePrecision: 2,
  },
  ...(
    [
      ['AAPL', 'Apple Inc.', 'Apple hisse'],
      ['MSFT', 'Microsoft Corp.', 'Microsoft'],
      ['NVDA', 'NVIDIA Corp.', 'Nvidia'],
      ['TSLA', 'Tesla Inc.', 'Tesla'],
      ['AMZN', 'Amazon.com Inc.', 'Amazon hisse'],
      ['GOOGL', 'Alphabet Inc.', 'Alphabet OR Google hisse'],
      ['META', 'Meta Platforms', '"Meta Platforms" OR Zuckerberg'],
    ] as const
  ).map(
    ([ticker, name, newsQueryTr]): AssetDefinition => ({
      id: ticker,
      name,
      displaySymbol: ticker,
      assetClass: 'equity',
      quoteSource: 'yahoo',
      yahooSymbol: ticker,
      newsQueryTr,
      pricePrecision: 2,
    }),
  ),
]

export const ASSET_MAP: Readonly<Record<string, AssetDefinition>> = Object.fromEntries(
  ASSETS.map((a) => [a.id, a]),
)

export const DEFAULT_ASSET_ID = 'BTC'

export const TIMEFRAMES: readonly Timeframe[] = ['1m', '15m', '1h', '1D', '1W']

export const TIMEFRAME_SECONDS: Record<Timeframe, number> = {
  '1m': 60,
  '15m': 15 * 60,
  '1h': 60 * 60,
  '1D': 24 * 60 * 60,
  '1W': 7 * 24 * 60 * 60,
}

export const POLL_INTERVALS = {
  goldMs: 30_000,
  equitiesMs: 15_000,
  newsMs: 5 * 60_000,
} as const

/** How often buffered ticks are flushed into the store (caps UI updates to ~5 fps). */
export const TICK_FLUSH_MS = 200
