import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // The dev server proxies /api to the local serverless handler so the
    // GitHub token and model key never exist in browser-reachable code.
    // In production Vercel routes /api/* to the same handlers.
    proxy: { '/api': 'http://localhost:3001' },
  },
})
