import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Serve /api/* from the same handlers Vercel will run, inside the dev server.
 *
 * The alternative is a second process on another port plus a proxy, which
 * means `npm run dev` no longer starts the app and the first thing a new
 * contributor hits is a connection-refused they have to be told about. One
 * command should start the whole thing.
 */
function devApi(): Plugin {
  return {
    name: 'dev-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next()
        try {
          const route = req.url.split('?')[0].replace('/api/', '')
          const mod = await server.ssrLoadModule(`/api/${route}.ts`)
          const url = `http://localhost${req.url}`
          const response: Response = await mod.default(new Request(url, { method: req.method }))
          res.statusCode = response.status
          response.headers.forEach((v, k) => res.setHeader(k, v))
          res.end(await response.text())
        } catch (e) {
          res.statusCode = 500
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ error: (e as Error).message }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), devApi()],
})
