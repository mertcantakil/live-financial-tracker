import { useEffect, useRef, type RefObject } from 'react'

/**
 * Briefly highlights an element when `price` changes by toggling a CSS class
 * directly on the DOM node (no extra React render).
 */
export function usePriceFlash<T extends HTMLElement>(ref: RefObject<T | null>, price: number | undefined): void {
  const prev = useRef(price)

  useEffect(() => {
    const el = ref.current
    const before = prev.current
    prev.current = price
    if (!el || price === undefined || before === undefined || price === before) return

    const cls = price > before ? 'flash-up' : 'flash-down'
    el.classList.remove('flash-up', 'flash-down')
    void el.offsetWidth // restart the CSS animation
    el.classList.add(cls)
  }, [ref, price])
}
