// Stateless admin session, signed with the same ADMIN_UPLOAD_PASSWORD secret used previously for
// the single audio-upload page. No KV/session storage — this project deliberately avoids
// Cloudflare KV, so the session is a signed, expiring bearer token instead: the frontend proves
// it knows the password once via POST /admin/login, receives a token, and attaches it as
// `Authorization: Bearer <token>` on every subsequent /admin/* call. The Worker verifies the
// signature (and expiry) without storing anything server-side.
//
// This used to be a same-origin HttpOnly cookie, but the admin UI and the API are now served
// from different origins (frontend on webkeeper.ch, API on Cloudflare) — cookies with
// SameSite=Strict/Lax aren't sent cross-site at all, and SameSite=None reintroduces
// third-party-cookie fragility for no benefit, so a bearer token is the simpler fit here.

const SESSION_TTL_MS = 12 * 60 * 60 * 1000 // 12h

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return mismatch === 0
}

export async function createSessionToken(password: string): Promise<string> {
  const expires = Date.now() + SESSION_TTL_MS
  const signature = await hmac(password, String(expires))
  return `${expires}.${signature}`
}

export async function verifySessionToken(token: string | undefined | null, password: string): Promise<boolean> {
  if (!token || !password) return false
  const [expiresRaw, signature] = token.split('.')
  const expires = Number(expiresRaw)
  if (!expires || Date.now() > expires) return false
  const expected = await hmac(password, String(expires))
  return timingSafeEqual(signature ?? '', expected)
}

/** Pulls the token out of a standard `Authorization: Bearer <token>` header value. */
export function parseBearerToken(authorizationHeader: string | null | undefined): string | undefined {
  if (!authorizationHeader) return undefined
  const match = /^Bearer\s+(.+)$/i.exec(authorizationHeader.trim())
  return match?.[1]
}
