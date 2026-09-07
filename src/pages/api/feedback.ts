import type { APIRoute } from 'astro'
import { sendNotification } from '../../lib/notify'

export const prerender = false

export const POST: APIRoute = async ({ request }) => {
  const body = (await request.json()) as Record<string, string | undefined>

  if (!body.message) {
    return Response.json({ error: 'Fehlende Angaben.' }, { status: 400 })
  }

  await sendNotification('Parkplatz-Feedback', {
    Nachricht: body.message,
    Name: body.name,
    'E-Mail': body.email,
  })

  return Response.json({ ok: true })
}
