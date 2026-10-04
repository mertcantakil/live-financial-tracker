import type { ConnectionStatus } from '../types/market'
import { backoffDelay, describeError, isAbortError } from './http'

export interface PollerOptions {
  intervalMs: number
  task: (signal: AbortSignal) => Promise<void>
  onStatus: (status: ConnectionStatus, info?: { attempt: number; retryAt?: number; error?: string }) => void
}

/**
 * Self-scheduling poller: no overlapping requests, backoff on failure,
 * paused while the tab is hidden and refreshed as soon as it is visible again.
 */
export function createPoller({ intervalMs, task, onStatus }: PollerOptions) {
  let timer: ReturnType<typeof setTimeout> | undefined
  let controller: AbortController | null = null
  let attempt = 0
  let stopped = true
  let hasSucceeded = false

  const schedule = (delay: number) => {
    clearTimeout(timer)
    timer = setTimeout(run, delay)
  }

  const run = async () => {
    if (stopped) return
    if (document.hidden) return // resumed by visibilitychange
    controller?.abort()
    controller = new AbortController()
    if (!hasSucceeded) onStatus(attempt === 0 ? 'connecting' : 'reconnecting', { attempt })

    try {
      await task(controller.signal)
      hasSucceeded = true
      attempt = 0
      onStatus('open', { attempt: 0 })
      schedule(intervalMs)
    } catch (err) {
      if (stopped || isAbortError(err)) return
      const delay = Math.max(backoffDelay(attempt, 2_000, 60_000), 2_000)
      attempt += 1
      onStatus('reconnecting', { attempt, retryAt: Date.now() + delay, error: describeError(err) })
      schedule(delay)
    }
  }

  const onVisibility = () => {
    if (!document.hidden && !stopped) schedule(0)
  }
  const onOnline = () => {
    attempt = 0
    if (!stopped) schedule(0)
  }

  return {
    start() {
      if (!stopped) return
      stopped = false
      document.addEventListener('visibilitychange', onVisibility)
      window.addEventListener('online', onOnline)
      schedule(0)
    },
    stop() {
      stopped = true
      clearTimeout(timer)
      controller?.abort()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('online', onOnline)
      onStatus('idle', { attempt: 0 })
    },
  }
}
