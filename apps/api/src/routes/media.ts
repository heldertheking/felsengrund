import { Hono } from 'hono';
import type { Env } from '../types';
import { createLogger } from '@felsengrund/logger';

// Uses c.req.path (not c.req.param('*'), which returns undefined in Hono 4.13.7) for the media key.
export const mediaRoute = new Hono<{ Bindings: Env }>();

type ParsedRange = { offset: number; length?: number } | { suffix: number };

/** Parses an HTTP Range header (RFC 7233: `bytes=200-499`, `bytes=500-`, `bytes=-500`). Undefined if missing/malformed. */
function parseRangeHeader(header: string | null): ParsedRange | undefined {
  if (!header) return undefined;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return undefined;
  const [, startStr, endStr] = match;
  if (startStr === '' && endStr === '') return undefined;

  if (startStr === '') {
    const suffix = Number(endStr);
    return Number.isFinite(suffix) && suffix > 0 ? { suffix } : undefined;
  }

  const offset = Number(startStr);
  if (!Number.isFinite(offset) || offset < 0) return undefined;
  if (endStr === '') return { offset };

  const end = Number(endStr);
  if (!Number.isFinite(end) || end < offset) return undefined;
  return { offset, length: end - offset + 1 };
}

function toR2Range(range: ParsedRange): R2Range {
  return 'suffix' in range ? { suffix: range.suffix } : { offset: range.offset, length: range.length };
}

const logger = createLogger('media', { level: 'info' });

mediaRoute.get('/media/*', async (c) => {
  const key = c.req.path.replace(/^\/media\//, ''); // Stips /media/ to get R2 key
  if (!key) {
    logger.warn('request has no key after /media/', { path: c.req.path });
    return c.text('Not found.', 404);
  }

  const requestedRange = parseRangeHeader(c.req.header('range') ?? null);

  let object: R2ObjectBody | null;
  let servedRange = requestedRange;
  try {
    object = await c.env.STORAGE.get(key, requestedRange ? { range: toR2Range(requestedRange) } : undefined);
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
    return c.text('Not found.', 404);
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
