import { Hono } from 'hono';
import type {
  ContactInput,
  CounselingInput,
  ErrorResponse,
  FeedbackInput,
  OkResponse,
  PrayerRequestInput,
} from '@felsengrund/types';
import type { Env } from '../types';
import { FORMS, NotificationService } from '../lib/mail';

export const formsRoute = new Hono<{ Bindings: Env }>();

// Built once, shared by every route below - the mailer config doesn't depend on a request.
const notificationService = new NotificationService();

formsRoute.post('/contact', async (c) => {
  const body = (await c.req.json()) as Partial<ContactInput>;

  if (!body.name || !body.email || !body.subject || !body.message) {
    return c.json({ error: 'Fehlende Angaben.' } as ErrorResponse, 400);
  }

  await notificationService.send(
    `Kontaktformular: ${body.subject}`,
    {
      heading: 'Neue Kontaktanfrage',
      intro: 'Über das Kontaktformular auf der Website wurde eine neue Anfrage gestellt.',
      fields: [
        { label: 'Name', value: body.name },
        { label: 'E-Mail', value: body.email },
        { label: 'Betreff', value: body.subject },
      ],
      message: { label: 'Nachricht', value: body.message },
    },
    FORMS.CONTACT,
    c.env,
    { replyTo: { name: body.name, email: body.email } },
  );

  return c.json<OkResponse>({ ok: true });
});

formsRoute.post('/counseling', async (c) => {
  const body = (await c.req.json()) as Partial<CounselingInput>;

  if (!body.name || !body.email || !body.subject || !body.message) {
    return c.json({ error: 'Fehlende Angaben.' } as ErrorResponse, 400);
  }

  await notificationService.send(
    `Lebensberatung: ${body.subject}`,
    {
      heading: 'Neue Anfrage für Lebensberatung',
      intro: 'Über das Formular auf der Website wurde eine neue Anfrage für eine Lebensberatung gestellt.',
      fields: [
        { label: 'Name', value: body.name },
        { label: 'E-Mail', value: body.email },
        { label: 'Telefon', value: body.phone },
        { label: 'Bevorzugte Kontaktart', value: body.preferredContactMethod },
        { label: 'Bevorzugtes Geschlecht', value: body.preferredCounselorGender },
        { label: 'Betreff', value: body.subject },
      ],
      message: { label: 'Nachricht', value: body.message },
    },
    FORMS.CONSOLING,
    c.env,
    { replyTo: { name: body.name, email: body.email } },
  );

  return c.json<OkResponse>({ ok: true });
});

formsRoute.post('/feedback', async (c) => {
  const body = (await c.req.json()) as Partial<FeedbackInput>;

  if (!body.message) {
    return c.json({ error: 'Fehlende Angaben.' } as ErrorResponse, 400);
  }

  await notificationService.send(
    'Feedback zur Website',
    {
      heading: 'Neues Feedback',
      intro: 'Über das Feedback-Formular auf der Website wurde eine neue Rückmeldung eingereicht.',
      fields: [
        { label: 'Name', value: body.name },
        { label: 'E-Mail', value: body.email },
      ],
      message: { label: 'Feedback', value: body.message },
    },
    // Feedback has no dedicated mailbox - falls back to the general kontakt@ inbox.
    FORMS.UNSPECIFIED,
    c.env,
    body.email ? { replyTo: { name: body.name, email: body.email } } : undefined,
  );

  return c.json<OkResponse>({ ok: true });
});

formsRoute.post('/prayer-request', async (c) => {
  const body = (await c.req.json()) as Partial<PrayerRequestInput>;

  if (!body.topic || !body.description) {
    return c.json({ error: 'Fehlende Angaben.' } as ErrorResponse, 400);
  }

  await notificationService.send(
    `Gebetsanliegen: ${body.topic}`,
    {
      heading: 'Neues Gebetsanliegen',
      intro: 'Über das Formular auf der Website wurde ein neues Gebetsanliegen eingereicht.',
      fields: [
        { label: 'Von', value: body.displayName || 'Anonym' },
        { label: 'E-Mail', value: body.email },
        { label: 'Thema', value: body.topic },
      ],
      message: { label: 'Anliegen', value: body.description },
    },
    FORMS.PRAYER_REQUEST,
    c.env,
    body.email ? { replyTo: { name: body.displayName, email: body.email } } : undefined,
  );

  return c.json<OkResponse>({ ok: true });
});
