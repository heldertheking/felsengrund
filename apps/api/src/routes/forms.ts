import { Hono } from 'hono'
import { sendNotification } from '@felsengrund/shared'
import type { Env } from '../types'

export const formsRoute = new Hono<{ Bindings: Env }>()

formsRoute.post('/contact', async (c) => {
  const body = (await c.req.json()) as Record<string, string>

  if (!body.name || !body.email || !body.subject || !body.message) {
    return c.json({ error: 'Fehlende Angaben.' }, 400)
  }

  await sendNotification(c.env, 'contact', {
    name: body.name,
    email: body.email,
    subject: body.subject,
    message: body.message,
  })

  return c.json({ ok: true })
})

formsRoute.post('/counseling', async (c) => {
  const body = (await c.req.json()) as Record<string, string>

  if (!body.name || !body.email || !body.subject || !body.message) {
    return c.json({ error: 'Fehlende Angaben.' }, 400)
  }

  await sendNotification(c.env, 'counseling', {
    name: body.name,
    email: body.email,
    phone: body.phone,
    subject: body.subject,
    message: body.message,
    preferredContactMethod: body.preferredContactMethod,
    preferredCounselorGender: body.preferredCounselorGender,
  })

  return c.json({ ok: true })
})

formsRoute.post('/feedback', async (c) => {
  const body = (await c.req.json()) as Record<string, string | undefined>

  if (!body.message) {
    return c.json({ error: 'Fehlende Angaben.' }, 400)
  }

  await sendNotification(c.env, 'feedback', {
    message: body.message,
    name: body.name,
    email: body.email,
  })

  return c.json({ ok: true })
})

formsRoute.post('/prayer-request', async (c) => {
  const body = (await c.req.json()) as Record<string, string | boolean | undefined>

  if (!body.topic || !body.displayName || !body.description) {
    return c.json({ error: 'Fehlende Angaben.' }, 400)
  }

  await sendNotification(c.env, 'prayer-request', {
    topic: String(body.topic),
    displayName: String(body.displayName),
    description: String(body.description),
    email: body.email ? String(body.email) : undefined,
  })

  return c.json({ ok: true })
})
