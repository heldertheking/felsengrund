import { Hono } from 'hono';
import { createLogger } from '@felsengrund/logger';
import type { Env } from './types';
import { corsMiddleware } from './middleware/cors';
import { requestLogger } from './middleware/logger';
import { checkRequiredBindings } from './middleware/env-check';
import { formsRoute } from './routes/forms';
import { offersRoute } from './routes/offers';
import { podcastRoute } from './routes/podcast';
import { mediaRoute } from './routes/media';
import { adminRoute } from './routes/admin';

const logger = createLogger('app');

const app = new Hono<{ Bindings: Env }>();

app.use('*', requestLogger);
app.use('*', checkRequiredBindings);
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
 * Handles errors in a trackable way, logging a requestId alongside the full request context and
 * a properly serialized error (name/message/stack, see `@felsengrund/logger`) so a 500 can be
 * diagnosed from Workers Logs alone, without needing a live `wrangler tail` session.
 */
app.onError((error, c) => {
  const requestId = crypto.randomUUID();
  logger.error('unhandled request error', {
    requestId,
    method: c.req.method,
    path: c.req.path,
    query: c.req.query(),
    origin: c.req.header('origin') ?? '-',
    environment: c.env.ENVIRONMENT,
    error,
  });
  return c.json({ error: 'Internal server error.', requestId }, 500);
});

export default app;
