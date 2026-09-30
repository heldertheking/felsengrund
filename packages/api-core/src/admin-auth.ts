// Stateless, signed bearer-token auth (no KV/session storage): POST /admin/login proves the
// KFA_ADMIN_PASSWORD once and returns a token; every later /admin/* call sends it as
// `Authorization: Bearer <token>`, verified by signature + expiry alone. Not a cookie, since
// the admin UI and API are different origins where SameSite cookies don't work well cross-site.

const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

export async function createSessionToken(password: string): Promise<string> {
  const expires = Date.now() + SESSION_TTL_MS;
  const signature = await hmac(password, String(expires));
  return `${expires}.${signature}`;
}

export async function verifySessionToken(token: string | undefined | null, password: string): Promise<boolean> {
  if (!token || !password) return false;
  const [expiresRaw, signature] = token.split('.');
  const expires = Number(expiresRaw);
  if (!expires || Date.now() > expires) return false;
  const expected = await hmac(password, String(expires));
  return timingSafeEqual(signature ?? '', expected);
}

/** Pulls the token out of a standard `Authorization: Bearer <token>` header value. */
export function parseBearerToken(authorizationHeader: string | null | undefined): string | undefined {
  if (!authorizationHeader) return undefined;
  const match = /^Bearer\s+(\S.*)$/i.exec(authorizationHeader.trim());
  return match?.[1]?.trimEnd();
}
