import type { APIRoute } from 'astro'
import { sendNotification } from '../../lib/notify'

export const prerender = false

export const POST: APIRoute = async ({ request }) => {
  const body = (await request.json()) as Record<string, string>

  if (!body.name || !body.email || !body.subject || !body.message) {
    return Response.json({ error: 'Fehlende Angaben.' }, { status: 400 })
  }

  await sendNotification(`Kontaktformular: ${body.subject}`, {
    Name: body.name,
    'E-Mail': body.email,
    Betreff: body.subject,
    Nachricht: body.message,
  })

  return Response.json({ ok: true })
}
