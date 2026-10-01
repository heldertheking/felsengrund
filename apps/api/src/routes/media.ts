import { Hono } from 'hono';
import { createApiError, Env } from '../types';
import { createLogger } from '@felsengrund/logger';
import { MediaUtils } from '../lib';

// === Setup ===
export const mediaRoute = new Hono<{ Bindings: Env }>();
const logger = createLogger('Media Route');

// === Routes ===

mediaRoute.get('/media/*', async (c) => {
  const key = c.req.path.replace(/^\/media\//, ''); // Stips /media/ to get R2 key
  if (!key) {
    logger.warn('Invalid request to /media, no key found', { path: c.req.path });
    return c.json(createApiError('Malformed request to /media/*; missing key', { path: c.req.path }), 400);
  }

  const requestedRange = MediaUtils.parseRangeHeader(c.req.header('range') ?? null);

  let object: R2ObjectBody | null;
  let servedRange = requestedRange;
  try {
    object = await c.env.STORAGE.get(key, requestedRange ? { range: MediaUtils.toR2Range(requestedRange) } : undefined);
  } catch (error) {
    // Unsatisfiable or malformed range, returning full object as fallback
    logger.warn('requested range failed for key, falling back to full object', {
      path: c.req.path,
      error: error,
      range: servedRange,
    });
    servedRange = undefined;
    object = await c.env.STORAGE.get(key);
  }

  if (!object) {
    logger.warn('key not found in R2', { path: c.req.path });
    return c.json(createApiError('Object not found', { path: c.req.path, key: key }), 404);
  }

  // Build response headers
  const headers = new Headers();
  headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream');
  headers.set('Cache-Control', 'public, max-age=3600');
  headers.set('Accept-Ranges', 'bytes');

  if (servedRange) {
    // Resolve against object.size
    const offset =
      'suffix' in servedRange
        ? Math.max(object.size - servedRange.suffix, 0)
        : Math.min(servedRange.offset, object.size);
    const length =
      'suffix' in servedRange
        ? Math.min(servedRange.suffix, object.size)
        : Math.min(servedRange.length ?? object.size - offset, object.size - offset);
    const end = offset + length - 1;
    headers.set('Content-Range', `bytes ${offset}-${end}/${object.size}`);
    headers.set('Content-Length', String(length));
    return new Response(object.body, { status: 206, headers });
  }

  headers.set('Content-Length', String(object.size));
  return new Response(object.body, { status: 200, headers });
});
