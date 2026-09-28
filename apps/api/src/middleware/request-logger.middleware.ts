import type { MiddlewareHandler } from 'hono';
import { createLogger } from '@felsengrund/logger';
import type { Env } from '../types';

const logger = createLogger('Request');

/** Logs every request/response; runs before corsMiddleware so rejected requests are logged too. */
export const requestLogger: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const start = Date.now();
  const { method } = c.req;
  const path = c.req.path;
  const origin = c.req.header('origin') ?? '-';

  logger.info('request', { method, path, origin });

  await next();

  const durationMs = Date.now() - start;
  logger.info('response', { method, path, status: c.res.status, durationMs });
};
