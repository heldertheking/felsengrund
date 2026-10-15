import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthUtils } from '../src/lib';
import { ADMIN_PASSWORD, authHeaders, call, clearBucket, formBody, validToken } from './helpers';

beforeEach(clearBucket);

afterEach(() => {
  vi.useRealTimers();
});

describe('AuthUtils.verifyPassword', () => {
  it('accepts the expected password only', async () => {
    expect(await AuthUtils.verifyPassword('secret', 'secret')).toBe(true);
    expect(await AuthUtils.verifyPassword('Secret', 'secret')).toBe(false);
    expect(await AuthUtils.verifyPassword('secret ', 'secret')).toBe(false);
  });

  it('rejects non-strings and an unset expected password', async () => {
    expect(await AuthUtils.verifyPassword(undefined, 'secret')).toBe(false);
    expect(await AuthUtils.verifyPassword(123, 'secret')).toBe(false);
    expect(await AuthUtils.verifyPassword('', '')).toBe(false);
    expect(await AuthUtils.verifyPassword('secret', undefined)).toBe(false);
  });
});

describe('session tokens', () => {
  it('has the shape <expiry>.<base64url signature>', async () => {
    const token = await AuthUtils.createSessionToken('pw', 1000);
    expect(token).toMatch(/^\d+\.[A-Za-z0-9_-]+$/);
  });

  it('verifies a fresh token', async () => {
    expect(await AuthUtils.verifySessionToken(await AuthUtils.createSessionToken('pw', 1000), 'pw')).toBe(true);
  });

  it('rejects a token signed with another password', async () => {
    expect(await AuthUtils.verifySessionToken(await AuthUtils.createSessionToken('other', 1000), 'pw')).toBe(false);
  });

  it('rejects a token whose expiry was tampered with', async () => {
    const [, signature] = (await AuthUtils.createSessionToken('pw', 1000)).split('.');
    const forged = `${Date.now() + 10_000_000}.${signature}`;
    expect(await AuthUtils.verifySessionToken(forged, 'pw')).toBe(false);
  });

  it('rejects an expired token', async () => {
    vi.useFakeTimers({ now: 1_000_000, toFake: ['Date'] });
    const token = await AuthUtils.createSessionToken('pw', 1000);
    vi.setSystemTime(1_000_999);
    expect(await AuthUtils.verifySessionToken(token, 'pw')).toBe(true);
    vi.setSystemTime(1_001_001);
    expect(await AuthUtils.verifySessionToken(token, 'pw')).toBe(false);
  });

  it.each([undefined, null, '', 'garbage', '.', 'abc.def', '123', '0.sig'])(
    'rejects the malformed token %j',
    async (t) => {
      expect(await AuthUtils.verifySessionToken(t, 'pw')).toBe(false);
    },
  );

  it('rejects everything when no password is configured', async () => {
    expect(await AuthUtils.verifySessionToken(await AuthUtils.createSessionToken('pw', 1000), '')).toBe(false);
  });
});

describe('AuthUtils.parseBearerToken', () => {
  it('extracts the token (case-insensitive scheme, extra whitespace)', () => {
    expect(AuthUtils.parseBearerToken('Bearer abc.def')).toBe('abc.def');
    expect(AuthUtils.parseBearerToken('bearer   abc')).toBe('abc');
    expect(AuthUtils.parseBearerToken('  Bearer abc  ')).toBe('abc');
  });

  it.each([undefined, null, '', 'Bearer', 'Bearer ', 'Basic abc', 'abc'])('returns undefined for %j', (header) => {
    expect(AuthUtils.parseBearerToken(header)).toBeUndefined();
  });
});

describe('POST /admin/login', () => {
  const login = (fields: Record<string, string | undefined>, overrides = {}) =>
    call('/admin/login', { method: 'POST', body: formBody(fields) }, overrides);

  it('returns a session token for the right password', async () => {
    const res = await login({ password: ADMIN_PASSWORD });
    expect(res.status).toBe(200);
    const { token } = (await res.json()) as { token: string };
    expect(await AuthUtils.verifySessionToken(token, ADMIN_PASSWORD)).toBe(true);
  });

  it('honours KFA_SESSION_TTL_MS for the token expiry', async () => {
    const before = Date.now();
    const res = await login({ password: ADMIN_PASSWORD }, { KFA_SESSION_TTL_MS: '5000' });
    const { token } = (await res.json()) as { token: string };
    const expires = Number(token.split('.')[0]);
    expect(expires).toBeGreaterThanOrEqual(before + 5000);
    expect(expires).toBeLessThanOrEqual(Date.now() + 5000);
  });

  it('falls back to a 12 hour session without a valid TTL', async () => {
    const before = Date.now();
    const res = await login({ password: ADMIN_PASSWORD }, { KFA_SESSION_TTL_MS: 'abc' });
    const { token } = (await res.json()) as { token: string };
    expect(Number(token.split('.')[0])).toBeGreaterThanOrEqual(before + 12 * 60 * 60 * 1000);
  });

  it('answers 401 for a wrong password, a missing password and an unset server password', async () => {
    expect((await login({ password: 'nope' })).status).toBe(401);
    expect((await login({})).status).toBe(401);
    expect((await login({ password: ADMIN_PASSWORD }, { KFA_ADMIN_PASSWORD: undefined })).status).toBe(401);
  });

  it('logout is always ok', async () => {
    const res = await call('/admin/logout', { method: 'POST' });
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe('admin auth middleware', () => {
  const protectedRequests: [string, string][] = [
    ['POST', '/admin/offers'],
    ['POST', '/admin/offers/import'],
    ['DELETE', '/admin/offers/some-slug'],
    ['POST', '/admin/podcast'],
    ['DELETE', '/admin/podcast/some-slug'],
  ];

  it.each(protectedRequests)('%s %s answers 401 without a token', async (method, path) => {
    const res = await call(path, { method });
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ status: 'error', message: 'Nicht angemeldet.' });
  });

  it.each([
    ['a garbage token', 'Bearer garbage'],
    ['a non-bearer scheme', `Basic ${'x'.repeat(10)}`],
    ['an empty bearer', 'Bearer '],
  ])('answers 401 with %s', async (_label, authorization) => {
    const res = await call('/admin/offers/x', { method: 'DELETE', headers: { Authorization: authorization } });
    expect(res.status).toBe(401);
  });

  it('answers 401 for a token signed with the wrong password', async () => {
    const token = await AuthUtils.createSessionToken('wrong', 60_000);
    const res = await call('/admin/offers/x', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    expect(res.status).toBe(401);
  });

  it('answers 401 for an expired token', async () => {
    const token = await validToken(-1000);
    const res = await call('/admin/offers/x', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    expect(res.status).toBe(401);
  });

  it('answers 401 when the server has no admin password', async () => {
    const token = await validToken();
    const res = await call(
      '/admin/offers/x',
      { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } },
      { KFA_ADMIN_PASSWORD: undefined },
    );
    expect(res.status).toBe(401);
  });

  it('lets a valid token through', async () => {
    const res = await call('/admin/offers/x', { method: 'DELETE', headers: await authHeaders() });
    expect(res.status).toBe(200);
  });

  it('checks the token before validating the body', async () => {
    const res = await call('/admin/offers', { method: 'POST', body: formBody({}) });
    expect(res.status).toBe(401);
  });
});
