import type { APIRoute } from 'astro'
import { sendNotification } from '../../lib/notify'

export const prerender = false

export const POST: APIRoute = async ({ request }) => {
  const body = (await request.json()) as Record<string, string | boolean | undefined>

  if (!body.topic || !body.displayName || !body.description) {
    return Response.json({ error: 'Fehlende Angaben.' }, { status: 400 })
  }

  const publish = body.publishOnWall === true || body.publishOnWall === 'yes'

  await sendNotification(`Gebetsanliegen: ${body.topic}`, {
    Thema: String(body.topic),
    Name: String(body.displayName),
    Anliegen: String(body.description),
    'E-Mail': body.email ? String(body.email) : undefined,
    'Beten bis': body.prayUntil ? String(body.prayUntil) : undefined,
    'Auf Gebetswand veröffentlichen': publish ? 'Ja' : 'Nein',
  })

  return Response.json({ ok: true })
}
