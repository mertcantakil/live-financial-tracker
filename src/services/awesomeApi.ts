import { ApiError, getJson, type RequestOptions } from './http'

const BASE = 'https://economia.awesomeapi.com.br/json'

interface RawQuote {
  code: string
  codein: string
  bid: string
  ask: string
  high: string
  low: string
  varBid: string
  pctChange: string
  timestamp: string
}

export interface SpotQuote {
  pair: string
  price: number
  previousClose: number
  high: number
  low: number
  /** UNIX ms. */
  timestamp: number
}

/** Spot quotes for currency / metal pairs, e.g. `["XAU-USD", "EUR-USD"]`. */
export async function fetchSpotQuotes(pairs: string[], opts?: RequestOptions): Promise<SpotQuote[]> {
  const json = await getJson<Record<string, RawQuote>>(`${BASE}/last/${pairs.join(',')}`, opts)

  return pairs.map((pair) => {
    const raw = json[pair.replace('-', '')]
    if (!raw) throw new ApiError('parse', `Missing quote for ${pair}`)
    const bid = +raw.bid
    const ask = +raw.ask
    const price = ask > 0 ? (bid + ask) / 2 : bid
    return {
      pair,
      price,
      previousClose: price - +raw.varBid,
      high: +raw.high,
      low: +raw.low,
      timestamp: +raw.timestamp * 1_000,
    }
  })
}
