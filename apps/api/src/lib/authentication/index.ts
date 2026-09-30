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

/** Constant-time password check (both sides are HMAC'd first so length differences don't leak either). */
export async function verifyPassword(input: unknown, expected: string | undefined): Promise<boolean> {
  if (typeof input !== 'string' || !expected) return false;
  const [a, b] = await Promise.all([hmac(expected, input), hmac(expected, expected)]);
  return timingSafeEqual(a, b);
}

/** Session TTL needs to be passed because it's read from cloudflare environment. */
export async function createSessionToken(password: string, SESSION_TTL_MS: number): Promise<string> {
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
