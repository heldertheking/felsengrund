import type { APIRoute } from 'astro'
import { sendNotification } from '../../lib/notify'

export const prerender = false

export const POST: APIRoute = async ({ request }) => {
  const body = (await request.json()) as Record<string, string>

  if (!body.name || !body.email || !body.subject || !body.message) {
    return Response.json({ error: 'Fehlende Angaben.' }, { status: 400 })
  }

  await sendNotification('contact', {
    name: body.name,
    email: body.email,
    subject: body.subject,
    message: body.message,
  })

  return Response.json({ ok: true })
}
