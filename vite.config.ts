import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type ProxyOptions } from 'vite'

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'

// Dev mirror of api/proxy.ts. Yahoo and Google News send no CORS headers
// and reject requests carrying a foreign Origin.
const upstreamProxy = (target: string, prefix: string): ProxyOptions => ({
  target,
  changeOrigin: true,
  secure: true,
  rewrite: (path) => path.replace(new RegExp(`^${prefix}`), ''),
  headers: { 'User-Agent': BROWSER_UA },
  configure: (proxy) => {
    proxy.on('proxyReq', (proxyReq) => {
      proxyReq.removeHeader('origin')
      proxyReq.removeHeader('referer')
      proxyReq.removeHeader('cookie')
    })
  },
})

// Trailing slashes keep '/api/yahoo/' from also matching '/api/yahoo-rss/'.
const proxy = {
  '/api/yahoo/': upstreamProxy('https://query1.finance.yahoo.com', '/api/yahoo'),
  '/api/yahoo-rss/': upstreamProxy('https://feeds.finance.yahoo.com', '/api/yahoo-rss'),
  '/api/gnews/': upstreamProxy('https://news.google.com', '/api/gnews'),
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { proxy },
  preview: { proxy },
})
