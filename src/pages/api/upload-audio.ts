import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'

export const prerender = false

export const POST: APIRoute = async ({ request }) => {
  const formData = await request.formData()
  const password = formData.get('password')
  const file = formData.get('file')

  if (!env.ADMIN_UPLOAD_PASSWORD || password !== env.ADMIN_UPLOAD_PASSWORD) {
    return Response.json({ error: 'Falsches Passwort.' }, { status: 401 })
  }

  if (!(file instanceof File)) {
    return Response.json({ error: 'Keine Datei erhalten.' }, { status: 400 })
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '-')
  const key = `podcast/${Date.now()}-${safeName}`

  await env.STORAGE.put(key, file, {
    httpMetadata: { contentType: file.type || 'application/octet-stream' },
  })

  return Response.json({ url: `${env.PUBLIC_CDN_DOMAIN}/${key}` })
}
