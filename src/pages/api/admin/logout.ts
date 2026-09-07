import type { APIRoute } from 'astro'
import { clearSessionCookie } from '../../../lib/admin-auth'

export const prerender = false

export const POST: APIRoute = async () => {
  return Response.json({ ok: true }, { headers: { 'Set-Cookie': clearSessionCookie } })
}
