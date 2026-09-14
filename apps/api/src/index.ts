import { Hono } from 'hono';
import type { Env } from './types';
import { corsMiddleware } from './middleware/cors';
import { requestLogger } from './middleware/logger';
import { formsRoute } from './routes/forms';
import { offersRoute } from './routes/offers';
import { podcastRoute } from './routes/podcast';
import { mediaRoute } from './routes/media';
import { adminRoute } from './routes/admin';

const app = new Hono<{ Bindings: Env }>();

app.use('*', requestLogger);
app.use('*', corsMiddleware);

app.route('/', formsRoute);
app.route('/', offersRoute);
app.route('/', podcastRoute);
app.route('/', mediaRoute);
app.route('/', adminRoute);

/**
 * API only worker, no UI served. Admin ui lives on main page
 */
app.notFound((c) => {
  console.warn(`[404] ${c.req.method} ${c.req.path}`);
  return c.json({ error: 'Not found.' }, 404);
});

/**
 * Handles errors in a trackable way logging both a message and request ID for tracking.
 */
app.onError((error, c) => {
  const requestId = crypto.randomUUID();
  console.error(`[error] requestId=${requestId} ${c.req.method} ${c.req.path}`, error);
  return c.json({ error: 'Internal server error.', requestId }, 500);
});

export default app;
