import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import { verifySession } from '../../../../lib/admin-auth'
import { deleteOffer } from '../../../../lib/admin-content'

export const prerender = false

export const DELETE: APIRoute = async ({ request, params }) => {
  const authenticated = await verifySession(request.headers.get('cookie'), env.ADMIN_UPLOAD_PASSWORD ?? '')
  if (!authenticated) return Response.json({ error: 'Nicht angemeldet.' }, { status: 401 })

  const slug = params.slug
  if (!slug) return Response.json({ error: 'Fehlender Slug.' }, { status: 400 })

  await deleteOffer(env.STORAGE, slug)

  return Response.json({ ok: true })
}
