import { beforeEach, describe, expect, it } from 'vitest';
import { MediaUtils } from '../src/lib';
import { call, clearBucket, testEnv } from './helpers';

/** Reads the binary (audio/*) body as text without workerd's "Called .text() on a non-text body" warning. */
const bodyText = async (res: Response) => new TextDecoder().decode(await res.arrayBuffer());

beforeEach(async () => {
  await clearBucket();
  await testEnv.STORAGE.put('podcast/a.mp3', '0123456789', { httpMetadata: { contentType: 'audio/mpeg' } });
});

describe('MediaUtils.parseRangeHeader', () => {
  it.each([
    ['bytes=0-4', { offset: 0, length: 5 }],
    ['bytes=5-', { offset: 5 }],
    ['bytes=-3', { suffix: 3 }],
    [' bytes=2-2 ', { offset: 2, length: 1 }],
  ])('parses %s', (header, expected) => {
    expect(MediaUtils.parseRangeHeader(header)).toEqual(expected);
  });

  it.each([null, '', 'bytes=-', 'bytes=5-2', 'bytes=-0', 'items=0-5', 'bytes=0-5,10-12', 'bytes=a-b'])(
    'ignores %j',
    (header) => {
      expect(MediaUtils.parseRangeHeader(header)).toBeUndefined();
    },
  );

  it('maps to the R2 range shape', () => {
    expect(MediaUtils.toR2Range({ suffix: 4 })).toEqual({ suffix: 4 });
    expect(MediaUtils.toR2Range({ offset: 1, length: 2 })).toEqual({ offset: 1, length: 2 });
  });
});

describe('MediaUtils.rewriteMediaUrls', () => {
  it('rewrites only /media/ URLs in the media fields, without mutating the input', () => {
    const data = {
      cardImage: '/media/images/x.png',
      coverImage: 'https://cdn.test/y.png',
      audioUrl: '/media/podcast/z.mp3',
      title: '/media/not-a-media-field',
    };
    expect(MediaUtils.rewriteMediaUrls(testEnv, data)).toEqual({
      cardImage: `${testEnv.KFA_WORKER_ORIGIN}/media/images/x.png`,
      coverImage: 'https://cdn.test/y.png',
      audioUrl: `${testEnv.KFA_WORKER_ORIGIN}/media/podcast/z.mp3`,
      title: '/media/not-a-media-field',
    });
    expect(data.cardImage).toBe('/media/images/x.png');
  });
});

describe('GET /media/*', () => {
  it('streams the object with its content type', async () => {
    const res = await call('/media/podcast/a.mp3');
    expect(res.status).toBe(200);
    expect(await bodyText(res)).toBe('0123456789');
    expect(res.headers.get('Content-Type')).toBe('audio/mpeg');
    expect(res.headers.get('Content-Length')).toBe('10');
    expect(res.headers.get('Accept-Ranges')).toBe('bytes');
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=3600');
  });

  it('answers 404 for a missing key and 400 for an empty one', async () => {
    const missing = await call('/media/podcast/none.mp3');
    expect(missing.status).toBe(404);
    expect(await missing.json()).toMatchObject({ status: 'error', message: 'Object not found' });

    const empty = await call('/media/');
    expect(empty.status).toBe(400);
  });

  it('serves a byte range as 206 with Content-Range', async () => {
    const res = await call('/media/podcast/a.mp3', { headers: { Range: 'bytes=2-5' } });
    expect(res.status).toBe(206);
    expect(await bodyText(res)).toBe('2345');
    expect(res.headers.get('Content-Range')).toBe('bytes 2-5/10');
    expect(res.headers.get('Content-Length')).toBe('4');
  });

  it('serves open-ended and suffix ranges', async () => {
    const open = await call('/media/podcast/a.mp3', { headers: { Range: 'bytes=7-' } });
    expect(await bodyText(open)).toBe('789');
    expect(open.headers.get('Content-Range')).toBe('bytes 7-9/10');

    const suffix = await call('/media/podcast/a.mp3', { headers: { Range: 'bytes=-3' } });
    expect(suffix.status).toBe(206);
    expect(await bodyText(suffix)).toBe('789');
    expect(suffix.headers.get('Content-Range')).toBe('bytes 7-9/10');
  });

  it('serves the whole object for a malformed range header', async () => {
    const res = await call('/media/podcast/a.mp3', { headers: { Range: 'garbage' } });
    expect(res.status).toBe(200);
    expect(await bodyText(res)).toBe('0123456789');
  });
});

describe('CORS', () => {
  it('echoes an allowed origin, including wildcard subdomains', async () => {
    for (const origin of ['http://localhost:4321', 'https://staging.kirche-felsengrund.ch']) {
      const res = await call('/', { headers: { Origin: origin } });
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe(origin);
      expect(res.headers.get('Vary')).toBe('Origin');
    }
  });

  it('does not allow other origins or look-alike hosts', async () => {
    for (const origin of [
      'https://evil.test',
      'https://kirche-felsengrund.ch.evil.test',
      'http://staging.kirche-felsengrund.ch',
    ]) {
      const res = await call('/', { headers: { Origin: origin } });
      expect(res.status).toBe(200);
      expect(res.headers.get('Access-Control-Allow-Origin'), origin).toBeNull();
    }
  });

  it('sends no CORS header without an Origin', async () => {
    expect((await call('/')).headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('answers a preflight for an allowed origin with 204 and the allowed methods', async () => {
    const res = await call('/forms', { method: 'OPTIONS', headers: { Origin: 'http://localhost:4321' } });
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:4321');
    expect(res.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, DELETE, OPTIONS');
    expect(res.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, Authorization');
  });

  it('answers a preflight for a disallowed origin without CORS headers', async () => {
    const res = await call('/forms', { method: 'OPTIONS', headers: { Origin: 'https://evil.test' } });
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('honours the configured allowlist', async () => {
    const res = await call(
      '/',
      { headers: { Origin: 'https://custom.test' } },
      { KFA_ALLOWED_ORIGINS: ' https://custom.test , ' },
    );
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://custom.test');
  });
});
