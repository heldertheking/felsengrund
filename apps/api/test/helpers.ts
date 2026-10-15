import { env } from 'cloudflare:workers';
import app from '../src/index';
import { AuthUtils } from '../src/lib';
import type { Env } from '../src/types';

export const ADMIN_PASSWORD = 'test-admin-password';
export const BASE = 'http://api.test';

/** The bindings configured in `vitest.config.ts` (fake secrets, local R2). */
export const testEnv = env as unknown as Env;

/** Sends a request through the real Hono app. `overrides` replaces individual bindings. */
export function call(path: string, init?: RequestInit, overrides: Partial<Env> = {}): Promise<Response> {
  return Promise.resolve(app.fetch(new Request(`${BASE}${path}`, init), { ...testEnv, ...overrides }));
}

export async function validToken(ttlMs = 60_000): Promise<string> {
  return AuthUtils.createSessionToken(ADMIN_PASSWORD, ttlMs);
}

export async function authHeaders(): Promise<Record<string, string>> {
  return { Authorization: `Bearer ${await validToken()}` };
}

export function formBody(fields: Record<string, string | Blob | undefined>): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (typeof value === 'string') form.set(key, value);
    else if (value !== undefined) form.set(key, value);
  }
  return form;
}

export function postJson(path: string, body: unknown, overrides: Partial<Env> = {}): Promise<Response> {
  return call(
    path,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    overrides,
  );
}

/** Empties the R2 bucket (it persists between tests of one file). */
export async function clearBucket(): Promise<void> {
  let cursor: string | undefined;
  do {
    const page = await testEnv.STORAGE.list({ cursor });
    if (page.objects.length > 0) await testEnv.STORAGE.delete(page.objects.map((object) => object.key));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
}

export async function listKeys(prefix = ''): Promise<string[]> {
  const page = await testEnv.STORAGE.list({ prefix });
  return page.objects.map((object) => object.key).sort();
}

export async function readText(key: string): Promise<string | null> {
  const object = await testEnv.STORAGE.get(key);
  return object ? object.text() : null;
}

export const bytes = (content: string, name: string, type: string): File => new File([content], name, { type });
