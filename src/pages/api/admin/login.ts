import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import { createSessionCookie } from '../../../lib/admin-auth'

export const prerender = false

export const POST: APIRoute = async ({ request }) => {
  const formData = await request.formData()
  const password = formData.get('password')

  if (!env.ADMIN_UPLOAD_PASSWORD || password !== env.ADMIN_UPLOAD_PASSWORD) {
    return Response.json({ error: 'Falsches Passwort.' }, { status: 401 })
  }

  return Response.json({ ok: true }, { headers: { 'Set-Cookie': await createSessionCookie(password) } })
}
