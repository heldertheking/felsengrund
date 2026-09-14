import { Hono } from 'hono';
import type { ContactInput, CounselingInput, FeedbackInput, PrayerRequestInput } from '@felsengrund/types';
import type { Env } from '../types';

export const formsRoute = new Hono<{ Bindings: Env }>();

formsRoute.post('/contact', async (c) => {
  const body = (await c.req.json()) as Partial<ContactInput>;

  if (!body.name || !body.email || !body.subject || !body.message) {
    return c.json({ error: 'Fehlende Angaben.' }, 400);
  }

  // await sendNotification(c.env, 'contact', {
  //   name: body.name,
  //   email: body.email,
  //   subject: body.subject,
  //   message: body.message,
  // })

  return c.json({ error: 'Not Implemented' }, 501);
});

formsRoute.post('/counseling', async (c) => {
  const body = (await c.req.json()) as Partial<CounselingInput>;

  if (!body.name || !body.email || !body.subject || !body.message) {
    return c.json({ error: 'Fehlende Angaben.' }, 400);
  }

  // await sendNotification(c.env, 'counseling', {
  //   name: body.name,
  //   email: body.email,
  //   phone: body.phone,
  //   subject: body.subject,
  //   message: body.message,
  //   preferredContactMethod: body.preferredContactMethod,
  //   preferredCounselorGender: body.preferredCounselorGender,
  // })

  return c.json({ error: 'Not Implemented' }, 501);
});

formsRoute.post('/feedback', async (c) => {
  const body = (await c.req.json()) as Partial<FeedbackInput>;

  if (!body.message) {
    return c.json({ error: 'Fehlende Angaben.' }, 400);
  }

  // await sendNotification(c.env, 'feedback', {
  //   message: body.message,
  //   name: body.name,
  //   email: body.email,
  // })

  return c.json({ error: 'Not Implemented' }, 501);
});

formsRoute.post('/prayer-request', async (c) => {
  const body = (await c.req.json()) as Partial<PrayerRequestInput>;

  if (!body.topic || !body.description) {
    return c.json({ error: 'Fehlende Angaben.' }, 400);
  }

  // await sendNotification(c.env, 'prayer-request', {
  //   topic: String(body.topic),
  //   displayName: body.displayName ? String(body.displayName) : 'Anonym',
  //   description: String(body.description),
  //   email: body.email ? String(body.email) : undefined,
  // })

  return c.json({ error: 'Not Implemented' }, 501);
});
