import { Hono } from 'hono'
import type { Env } from './types'
import { corsMiddleware } from './middleware/cors'
import { requestLogger } from './middleware/logger'
import { formsRoute } from './routes/forms'
import { offersRoute } from './routes/offers'
import { podcastRoute } from './routes/podcast'
import { mediaRoute } from './routes/media'
import { adminRoute } from './routes/admin'

const app = new Hono<{ Bindings: Env }>()

app.use('*', requestLogger)
app.use('*', corsMiddleware)

app.route('/', formsRoute)
app.route('/', offersRoute)
app.route('/', podcastRoute)
app.route('/', mediaRoute)
app.route('/', adminRoute)

// This Worker is a pure JSON/media API — no UI is served here at all (the admin CMS lives in
// the frontend app and calls these routes cross-origin). Anything else 404s.
app.notFound((c) => {
  console.warn(`[404] ${c.req.method} ${c.req.path}`)
  return c.json({ error: 'Not found.' }, 404)
})

// Without this, an uncaught throw anywhere in a route (e.g. an R2 put failing) is turned into a
// bare 500 by Hono's default handler with nothing logged — the request just vanishes from the
// caller's point of view. Logging the full error here, with a request id the client can quote
// back, is what makes "it failed in prod" actually diagnosable from Workers Logs / wrangler tail.
app.onError((error, c) => {
  const requestId = crypto.randomUUID()
  console.error(`[error] requestId=${requestId} ${c.req.method} ${c.req.path}`, error)
  return c.json({ error: 'Internal server error.', requestId }, 500)
})

export default app
