import type { APIRoute } from 'astro'
import { sendNotification } from '../../lib/notify'

export const prerender = false

export const POST: APIRoute = async ({ request }) => {
  const body = (await request.json()) as Record<string, string>

  if (!body.name || !body.email || !body.subject || !body.message) {
    return Response.json({ error: 'Fehlende Angaben.' }, { status: 400 })
  }

  await sendNotification('counseling', {
    name: body.name,
    email: body.email,
    phone: body.phone,
    subject: body.subject,
    message: body.message,
    preferredContactMethod: body.preferredContactMethod,
    preferredCounselorGender: body.preferredCounselorGender,
  })

  return Response.json({ ok: true })
}
