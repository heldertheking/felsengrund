import type { MiddlewareHandler } from 'hono';
import { createLogger } from '@felsengrund/logger';
import type { Env } from '../types';

const logger = createLogger('http');

/**
 * Logs every request/repsonse with enough detail to reconstruct what happened from Workers Logs
 * <p>Applied before {@link corsMiddleware} to ensure cors rejected requests also get logged</p>
 * @param c
 * @param next
 */
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
