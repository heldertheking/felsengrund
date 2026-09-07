import type { APIRoute } from 'astro'
import { sendNotification } from '../../lib/notify'

export const prerender = false

export const POST: APIRoute = async ({ request }) => {
  const body = (await request.json()) as Record<string, string | boolean | undefined>

  if (!body.topic || !body.displayName || !body.description) {
    return Response.json({ error: 'Fehlende Angaben.' }, { status: 400 })
  }

  const publish = body.publishOnWall === true || body.publishOnWall === 'yes'

  await sendNotification('prayer-request', {
    topic: String(body.topic),
    displayName: String(body.displayName),
    description: String(body.description),
    email: body.email ? String(body.email) : undefined,
    prayUntil: body.prayUntil ? String(body.prayUntil) : undefined,
    publishOnWall: publish ? 'yes' : 'no',
  })

  return Response.json({ ok: true })
}
