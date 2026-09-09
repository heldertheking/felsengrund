import type { MiddlewareHandler } from 'hono'
import type { Env } from '../types'

/**
 * CORS for a bearer-token API: no cookies are ever involved (see packages/shared/src/admin-auth.ts),
 * so there's no need for Access-Control-Allow-Credentials — just an explicit origin allowlist
 * (never `*`, since form/admin routes accept POST with user data) and the headers our clients
 * actually send.
 */
export const corsMiddleware: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const allowedOrigins = c.env.ALLOWED_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
  const requestOrigin = c.req.header('Origin')
  const allowOrigin = requestOrigin && allowedOrigins.includes(requestOrigin) ? requestOrigin : undefined

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
