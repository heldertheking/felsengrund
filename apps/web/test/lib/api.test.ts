import { describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  UnauthorizedError,
  api,
  clearAdminToken,
  getAdminToken,
  setAdminToken,
  unwrap,
  unwrapOrNull,
} from '../../src/lib/api';
import { jsonResponse, mockApi } from '../helpers';

describe('admin token storage', () => {
  it('stores, reads and clears the token', () => {
    expect(getAdminToken()).toBeNull();
    setAdminToken('abc');
    expect(getAdminToken()).toBe('abc');
    clearAdminToken();
    expect(getAdminToken()).toBeNull();
  });

  it('degrades gracefully when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(getAdminToken()).toBeNull();
    expect(() => setAdminToken('x')).not.toThrow();
    expect(() => clearAdminToken()).not.toThrow();
  });
});

describe('error classes', () => {
  it('ApiError carries the status', () => {
    const error = new ApiError(404, 'weg');
    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({ status: 404, message: 'weg', name: 'ApiError' });
  });

  it('UnauthorizedError is a 401 ApiError with a German default message', () => {
    const error = new UnauthorizedError();
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 401, message: 'Nicht angemeldet.', name: 'UnauthorizedError' });
  });
});

describe('unwrap', () => {
  it('resolves with the parsed JSON body of a successful response', async () => {
    const body = await unwrap(Promise.resolve(jsonResponse({ hello: 'welt' })));
    expect(body).toEqual({ hello: 'welt' });
  });

  it("throws an ApiError carrying the API's message", async () => {
    const promise = unwrap(Promise.resolve(jsonResponse({ message: 'Ungültig.' }, 400)));
    await expect(promise).rejects.toMatchObject({ name: 'ApiError', status: 400, message: 'Ungültig.' });
  });

  it('falls back to "Fehler <status>" when the error body is not JSON or has no message', async () => {
    await expect(unwrap(Promise.resolve(new Response('<html>', { status: 502 })))).rejects.toMatchObject({
      status: 502,
      message: 'Fehler 502',
    });
    await expect(unwrap(Promise.resolve(jsonResponse({}, 500)))).rejects.toMatchObject({ message: 'Fehler 500' });
  });
});

describe('unwrapOrNull', () => {
  it('maps a 404 to null', async () => {
    expect(await unwrapOrNull(Promise.resolve(jsonResponse({ message: 'x' }, 404)))).toBeNull();
  });

  it('returns the body on success and throws for other errors', async () => {
    expect(await unwrapOrNull(Promise.resolve(jsonResponse({ a: 1 })))).toEqual({ a: 1 });
    await expect(unwrapOrNull(Promise.resolve(jsonResponse({ message: 'kaputt' }, 500)))).rejects.toMatchObject({
      status: 500,
      message: 'kaputt',
    });
  });
});

describe('api client', () => {
  it('sends public requests to the configured base URL without an Authorization header', async () => {
    setAdminToken('secret');
    const { calls } = mockApi({ 'GET /offers': () => jsonResponse([]) });

    await unwrap(api.offers.$get());

    expect(calls[0].url).toBe('http://api.test/offers');
    expect(calls[0].headers.has('Authorization')).toBe(false);
  });

  it('adds the bearer token to admin requests', async () => {
    setAdminToken('secret');
    const { calls } = mockApi({ 'DELETE /admin/offers/foo': () => jsonResponse({ ok: true }) });

    await unwrap(api.admin.offers[':slug'].$delete({ param: { slug: 'foo' } }));

    expect(calls[0].headers.get('Authorization')).toBe('Bearer secret');
  });

  it('does not send the token to the login endpoint', async () => {
    setAdminToken('old');
    const { calls } = mockApi({ 'POST /admin/login': () => jsonResponse({ token: 'new' }) });

    const result = await unwrap(api.admin.login.$post({ form: { password: 'pw' } }));

    expect(result).toEqual({ token: 'new' });
    expect(calls[0].headers.has('Authorization')).toBe(false);
  });

  it('clears the token and throws UnauthorizedError on a 401 from an admin endpoint', async () => {
    setAdminToken('expired');
    mockApi({ 'DELETE /admin/offers/foo': () => jsonResponse({ message: 'no' }, 401) });

    await expect(unwrap(api.admin.offers[':slug'].$delete({ param: { slug: 'foo' } }))).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    expect(getAdminToken()).toBeNull();
  });

  it('treats a 401 from the login endpoint as a normal ApiError and keeps the token', async () => {
    setAdminToken('keep');
    mockApi({ 'POST /admin/login': () => jsonResponse({ message: 'Falsches Passwort.' }, 401) });

    const error = await unwrap(api.admin.login.$post({ form: { password: 'bad' } })).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).not.toBeInstanceOf(UnauthorizedError);
    expect((error as ApiError).message).toBe('Falsches Passwort.');
    expect(getAdminToken()).toBe('keep');
  });
});
