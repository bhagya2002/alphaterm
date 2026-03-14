/**
 * Standalone API server for Render (or any Node host).
 * Build the API bundle first: npm run build:api
 * Then: node server/index.cjs
 */
const express = require('express')
const cors = require('cors')
const path = require('path')

const app = express()
const PORT = process.env.PORT || 3001

// CORS: allow frontend (Vercel or local); must run before routes
const allowedOrigins = [
  'https://alphaterm.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
]
if (process.env.CORS_ORIGIN) {
  const o = process.env.CORS_ORIGIN.replace(/\/$/, '')
  if (!allowedOrigins.includes(o)) allowedOrigins.push(o)
}
app.use(cors({
  origin: (orig, cb) => {
    if (!orig) return cb(null, true)
    const exact = allowedOrigins.some((a) => orig === a || orig === a + '/')
    const vercelPreview = /^https:\/\/[a-z0-9-]+\.vercel\.app\/?$/.test(orig)
    cb(null, exact || vercelPreview ? orig : false)
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-cron-secret'],
  optionsSuccessStatus: 204,
}))

app.use(express.json({ limit: '10mb' }))

// Load the bundled API handler (CJS)
const handlerModule = require(path.join(__dirname, '../api/index.cjs'))
const handler = handlerModule.default || handlerModule

// Mount all /api/* on the same handler; pass path for routing
app.all('/api', (req, res) => {
  req.query = req.query || {}
  req.query.path = ''
  handler(req, res).catch((err) => {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  })
})

app.all('/api/*', (req, res) => {
  req.query = req.query || {}
  const pathStr = req.path.replace(/^\/api\/?/, '').replace(/\/$/, '')
  req.query.path = pathStr
  handler(req, res).catch((err) => {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  })
})

app.get('/health', (_, res) => res.status(200).json({ ok: true }))

app.listen(PORT, () => {
  console.log(`AlphaTerm API listening on port ${PORT}`)
})
