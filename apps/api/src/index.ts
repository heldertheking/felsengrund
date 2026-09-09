import { Hono } from 'hono'
import type { Env } from './types'
import { corsMiddleware } from './middleware/cors'
import { formsRoute } from './routes/forms'
import { offersRoute } from './routes/offers'
import { podcastRoute } from './routes/podcast'
import { mediaRoute } from './routes/media'
import { adminRoute } from './routes/admin'

const app = new Hono<{ Bindings: Env }>()

app.use('*', corsMiddleware)

app.route('/', formsRoute)
app.route('/', offersRoute)
app.route('/', podcastRoute)
app.route('/', mediaRoute)
app.route('/', adminRoute)

// This Worker is a pure JSON/media API — no UI is served here at all (the admin CMS lives in
// the frontend app and calls these routes cross-origin). Anything else 404s.
app.notFound((c) => c.json({ error: 'Not found.' }, 404))

export default app
