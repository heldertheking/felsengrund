import type { MiddlewareHandler } from 'hono'
import type { Env } from '../types'

// An ALLOWED_ORIGINS entry of the form "https://*.example.com" matches "https://example.com"
// itself and any single- or multi-label subdomain of it (e.g. "https://staging.example.com").
// A plain entry (no "*.") must match the request Origin exactly.
function originMatches(pattern: string, origin: string): boolean {
  if (pattern === origin) return true
  const wildcard = pattern.match(/^(https?:\/\/)\*\.(.+)$/)
  if (!wildcard) return false
  const [, scheme, domain] = wildcard
  if (!origin.startsWith(scheme)) return false
  const host = origin.slice(scheme.length)
  return host === domain || host.endsWith(`.${domain}`)
}

/**
 * CORS for a bearer-token API: no cookies are ever involved (see packages/api-core/src/admin-auth.ts),
 * so there's no need for Access-Control-Allow-Credentials — just an explicit origin allowlist
 * (never `*`, since form/admin routes accept POST with user data) and the headers our clients
 * actually send.
 */
export const corsMiddleware: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const allowedOrigins = c.env.ALLOWED_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
  const requestOrigin = c.req.header('Origin')
  const allowOrigin =
    requestOrigin && allowedOrigins.some((pattern) => originMatches(pattern, requestOrigin))
      ? requestOrigin
      : undefined

  if (requestOrigin && !allowOrigin) {
    // Logged (not just silently dropped) so a stale/missing ALLOWED_ORIGINS entry shows up in
    // `wrangler tail` instead of only manifesting as an unexplained CORS error in the browser.
    console.warn(
      `[cors] Rejected origin "${requestOrigin}" — not in ALLOWED_ORIGINS (${allowedOrigins.join(', ') || '<empty>'})`,
    )
  }

  if (c.req.method === 'OPTIONS') {
    const headers = new Headers()
    if (allowOrigin) {
      headers.set('Access-Control-Allow-Origin', allowOrigin)
      headers.set('Vary', 'Origin')
      headers.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
      headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
      headers.set('Access-Control-Max-Age', '86400')
    }
    return new Response(null, { status: 204, headers })
  }

  await next()

  if (allowOrigin) {
    c.res.headers.set('Access-Control-Allow-Origin', allowOrigin)
    c.res.headers.set('Vary', 'Origin')
  }
}
