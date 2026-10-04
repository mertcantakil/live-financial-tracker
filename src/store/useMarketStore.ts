import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { useShallow } from 'zustand/react/shallow'
import { ASSET_MAP, DEFAULT_ASSET_ID } from '../config/assets'
import type {
  AssetDefinition,
  ConnectionStatus,
  FeedId,
  FeedState,
  MobileView,
  NewsLanguage,
  PriceTick,
  Quote,
  Timeframe,
} from '../types/market'

interface MarketActions {
  /** Also switches the mobile layout to the chart view. */
  selectAsset: (id: string) => void
  setTimeframe: (tf: Timeframe) => void
  setNewsLanguage: (lang: NewsLanguage) => void
  setMobileView: (view: MobileView) => void
  /** Merges a batch of ticks in a single state update. */
  applyTicks: (ticks: PriceTick[]) => void
  setFeedStatus: (feed: FeedId, status: ConnectionStatus, info?: { attempt?: number; retryAt?: number; error?: string }) => void
}

export interface MarketState {
  selectedId: string
  timeframe: Timeframe
  newsLanguage: NewsLanguage
  /** Active panel below the `lg` breakpoint. */
  mobileView: MobileView
  quotes: Record<string, Quote>
  feeds: Record<FeedId, FeedState>
  actions: MarketActions
}

const initialFeed: FeedState = { status: 'idle', attempt: 0 }

export const useMarketStore = create<MarketState>()(
  persist(
    (set) => ({
      selectedId: DEFAULT_ASSET_ID,
      timeframe: '15m',
      newsLanguage: 'tr',
      mobileView: 'chart',
      quotes: {},
      feeds: { 'binance-ws': initialFeed, gold: initialFeed, equities: initialFeed },

      actions: {
        selectAsset: (id) => {
          if (ASSET_MAP[id]) set({ selectedId: id, mobileView: 'chart' })
        },

        setTimeframe: (timeframe) => set({ timeframe }),

        setNewsLanguage: (newsLanguage) => set({ newsLanguage }),

        setMobileView: (mobileView) => set({ mobileView }),

        applyTicks: (ticks) =>
          set((state) => {
            let next: Record<string, Quote> | null = null

            for (const tick of ticks) {
              if (!Number.isFinite(tick.price)) continue
              const prev = (next ?? state.quotes)[tick.id]
              const reference = tick.reference ?? prev?.reference ?? tick.price
              const volume = tick.volume ?? 0

              // Identity is preserved for unchanged quotes so their subscribers skip rendering.
              if (prev && prev.price === tick.price && prev.reference === reference && volume === 0) continue

              const change = tick.price - reference
              next ??= { ...state.quotes }
              next[tick.id] = {
                id: tick.id,
                price: tick.price,
                reference,
                change,
                changePct: reference ? (change / reference) * 100 : 0,
                tickDirection: !prev || prev.price === tick.price ? (prev?.tickDirection ?? 'flat') : tick.price > prev.price ? 'up' : 'down',
                tickVolume: volume,
                updatedAt: tick.timestamp,
              }
            }

            return next ? { quotes: next } : state
          }),

        setFeedStatus: (feed, status, info) =>
          set((state) => {
            const prev = state.feeds[feed]
            const nextFeed: FeedState = {
              status,
              attempt: info?.attempt ?? 0,
              retryAt: info?.retryAt,
              lastError: status === 'open' ? undefined : (info?.error ?? prev.lastError),
            }
            if (
              prev.status === nextFeed.status &&
              prev.attempt === nextFeed.attempt &&
              prev.retryAt === nextFeed.retryAt &&
              prev.lastError === nextFeed.lastError
            ) {
              return state
            }
            return { feeds: { ...state.feeds, [feed]: nextFeed } }
          }),
      },
    }),
    {
      name: 'lmt:preferences',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ selectedId: s.selectedId, timeframe: s.timeframe, newsLanguage: s.newsLanguage }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<MarketState>
        return {
          ...current,
          selectedId: p.selectedId && ASSET_MAP[p.selectedId] ? p.selectedId : current.selectedId,
          timeframe: p.timeframe ?? current.timeframe,
          newsLanguage: p.newsLanguage === 'en' || p.newsLanguage === 'tr' ? p.newsLanguage : current.newsLanguage,
        }
      },
    },
  ),
)

/* ---------- Atomic selector hooks (each component subscribes to the minimum slice) ---------- */

export const useMarketActions = () => useMarketStore((s) => s.actions)

export const useQuote = (id: string): Quote | undefined => useMarketStore((s) => s.quotes[id])

export const useIsSelected = (id: string): boolean => useMarketStore((s) => s.selectedId === id)

export const useSelectedAsset = (): AssetDefinition => useMarketStore((s) => ASSET_MAP[s.selectedId])

export const useTimeframe = (): Timeframe => useMarketStore((s) => s.timeframe)

export const useNewsLanguage = (): NewsLanguage => useMarketStore((s) => s.newsLanguage)

export const useMobileView = (): MobileView => useMarketStore((s) => s.mobileView)

export const useFeeds = () => useMarketStore(useShallow((s) => s.feeds))

/** Non-reactive read for event handlers / imperative code. */
export const getMarketState = () => useMarketStore.getState()
