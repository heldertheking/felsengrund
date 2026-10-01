import { hc } from 'hono/client';
import type { AppType, Client } from '@felsengrund/api';

export const API_BASE_URL = import.meta.env.PUBLIC_API_BASE_URL;

if (!API_BASE_URL) {
  console.error(
    '[api] PUBLIC_API_BASE_URL is not set — every API request will be sent to the wrong origin. ' +
      'Local dev: copy apps/web/.env.example to apps/web/.env. ' +
      'CI/prod build: set the PUBLIC_API_BASE_URL repo variable in GitHub Actions.',
  );
}

const TOKEN_STORAGE_KEY = 'felsengrund-admin-token';

export function getAdminToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setAdminToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    // localStorage unavailable (private browsing, etc.) — admin session just won't persist.
  }
}

export function clearAdminToken(): void {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = 'Nicht angemeldet.') {
    super(401, message);
    this.name = 'UnauthorizedError';
  }
}

/** Admin endpoints (except login) need the bearer token; public ones are sent without it to stay simple CORS requests. */
function needsAuth(pathname: string): boolean {
  return pathname.startsWith('/admin/') && pathname !== '/admin/login';
}

const apiFetch: typeof fetch = async (input, init) => {
  const request = new Request(input, init);
  const { pathname } = new URL(request.url);
  const authed = needsAuth(pathname);

  if (authed) {
    const token = getAdminToken();
    if (token) request.headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(request);

  if (authed && response.status === 401) {
    clearAdminToken();
    throw new UnauthorizedError();
  }
  return response;
};

/**
 * Typed client for `apps/api`, generated from its route definitions (Hono RPC). The types come from
 * `@felsengrund/api`'s emitted declarations, so nothing from the Worker is bundled into the site.
 * Usage: `unwrap(api.offers.$get())`, `unwrap(api.offers[':slug'].$get({ param: { slug } }))`.
 */
export const api: Client = hc<AppType>(API_BASE_URL ?? '', { fetch: apiFetch });

interface JsonResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

/**
 * The JSON body of the success responses. Hono types the explicit error responses (`c.json(..., 404)`)
 * with `ok: false`, so those are dropped from the union; the success member is typed `ok: boolean`.
 */
type SuccessBody<R extends JsonResponse> = R extends { ok: false } ? never : Awaited<ReturnType<R['json']>>;

async function readErrorMessage(response: JsonResponse): Promise<string> {
  const data = (await response.json().catch(() => null)) as { message?: string } | null;
  return data?.message ?? `Fehler ${response.status}`;
}

/** Resolves with the success body, or throws an `ApiError` carrying the API's `message`. */
export async function unwrap<R extends JsonResponse>(request: Promise<R>): Promise<SuccessBody<R>> {
  const response = await request;
  if (!response.ok) throw new ApiError(response.status, await readErrorMessage(response));
  return (await response.json()) as SuccessBody<R>;
}

/** Like `unwrap`, but a 404 resolves to `null` (used for detail pages). */
export async function unwrapOrNull<R extends JsonResponse>(request: Promise<R>): Promise<SuccessBody<R> | null> {
  const response = await request;
  if (response.status === 404) return null;
  if (!response.ok) throw new ApiError(response.status, await readErrorMessage(response));
  return (await response.json()) as SuccessBody<R>;
}
