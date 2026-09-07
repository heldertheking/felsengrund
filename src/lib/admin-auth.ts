// Stateless admin session, signed with the same ADMIN_UPLOAD_PASSWORD secret used previously for
// the single audio-upload page. No KV/session storage — this project deliberately avoids
// Cloudflare KV (see astro.config.mjs), so the session is a signed, expiring cookie instead: a
// browser proves it knows the password once at /admin, then carries a token the server can verify
// without storing anything.

const COOKIE_NAME = 'kf_admin_session'
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

export async function createSessionCookie(password: string): Promise<string> {
  const expires = Date.now() + SESSION_TTL_MS
  const signature = await hmac(password, String(expires))
  const token = `${expires}.${signature}`
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_TTL_MS / 1000}`
}

export const clearSessionCookie = `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`

export async function verifySession(cookieHeader: string | null, password: string): Promise<boolean> {
  if (!cookieHeader || !password) return false
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`))
  if (!match) return false
  const [expiresRaw, signature] = match[1].split('.')
  const expires = Number(expiresRaw)
  if (!expires || Date.now() > expires) return false
  const expected = await hmac(password, String(expires))
  return timingSafeEqual(signature ?? '', expected)
}
