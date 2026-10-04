/**
 * Same-origin prefix for upstreams without CORS support (Yahoo, Google News).
 * Served by the Vite proxy in development and by the Firebase `api` function in production.
 */
export const API_BASE: string = (import.meta.env.VITE_API_BASE ?? '/api').replace(/\/$/, '')
