import { Hono } from 'hono';
import { createLogger } from '@felsengrund/logger';
import { createApiError, type Env } from './types';
import { corsMiddleware } from './middleware/cors.middleware';
import { requestLogger } from './middleware/request-logger.middleware';
import { checkRequiredBindings } from './middleware/env-check';
import { formsRoute } from './routes/forms';
import { offersRoute } from './routes/offers';
import { podcastRoute } from './routes/podcast';
import { mediaRoute } from './routes/media';
import { adminRoute } from './routes/admin';
import pkg from '../package.json';

const logger = createLogger('app');

const app = new Hono<{ Bindings: Env }>();

app.use('*', requestLogger);
app.use('*', checkRequiredBindings);
app.use('*', corsMiddleware);

app.get('/', (c) =>
  c.json({
    name: 'Kirche Felsengrund API',
    version: pkg.version,
    repository: pkg.repository,
    environment: c.env.ENVIRONMENT,
  }),
);

app.route('/', formsRoute);
app.route('/', offersRoute);
app.route('/', podcastRoute);
app.route('/', mediaRoute);
app.route('/', adminRoute);

// API only worker - no UI served; the admin UI lives in apps/web.
app.notFound((c) => {
  console.warn(`[404] ${c.req.method} ${c.req.path}`);
  return c.json(createApiError('Not found.'), 404);
});

// Logs full context + a requestId so a 500 can be diagnosed from Workers Logs alone.
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
  return c.json(createApiError('Internal server error.', { requestId }), 500);
});

export default app;
