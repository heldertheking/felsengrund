import { vi } from 'vitest';

/** A minimal JSON `Response`. */
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export type FetchHandler = (request: Request) => Response | Promise<Response>;

/**
 * Replaces the global `fetch` (what the Hono client and `sendForm` call) with a router keyed by
 * `"METHOD /path"`. Unmatched requests fail loudly so a test never hits a real API.
 */
export function mockApi(routes: Record<string, FetchHandler>) {
  const calls: Request[] = [];
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    calls.push(request);
    const key = `${request.method} ${new URL(request.url).pathname}`;
    const handler = routes[key];
    if (!handler) throw new Error(`Unmocked request: ${key}`);
    return handler(request);
  });
  vi.stubGlobal('fetch', fn);
  return { fn, calls };
}

/**
 * Under jsdom `FormData`, `File` and `Blob` are jsdom's, which Node's `Request` (what the API client
 * and `mockApi` use) cannot serialise. Tests that submit multipart forms swap in Node's own
 * implementations (tests of `new FormData(formElement)` must not use this).
 */
export async function useNativeFormData(): Promise<void> {
  const { Blob, File } = await import('node:buffer');
  // Node exposes no `FormData` export, but a Response parses bodies into its own implementation.
  const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
  const parsed = await new Response('a=1', { headers }).formData();
  vi.stubGlobal('FormData', parsed.constructor);
  vi.stubGlobal('File', File);
  vi.stubGlobal('Blob', Blob);
}
