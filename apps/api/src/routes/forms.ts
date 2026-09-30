import { Hono, type Context } from 'hono';
import type { ContactInput, CounselingInput, FeedbackInput, OkResponse, PrayerRequestInput } from '@felsengrund/types';
import { createFormError, Env } from '../types';
import { FORMS, NotificationService } from '../lib';
import type { SendOptions } from '../lib/notification';
import type { NotificationEmailContent } from '../lib/notification/email/notification-email';
import { createLogger } from '@felsengrund/logger';

// === Setup ===

export const formsRoute = new Hono<{ Bindings: Env }>();
const logger = createLogger('Forms Route');
const notificationService = new NotificationService();

// === Helpers ===

/** Sends the notification; returns an error response (to return from the route) if delivery fails, otherwise null. */
const deliver = async (
  c: Context<{ Bindings: Env }>,
  subject: string,
  content: NotificationEmailContent,
  form: FORMS,
  options?: SendOptions,
): Promise<Response | null> => {
  try {
    await notificationService.send(subject, content, form, c.env, options);
    return null;
  } catch (error) {
    logger.error('failed to send notification email', { form: FORMS[form], error });
    return c.json(createFormError('sending', 'Failed to send notification'), 502);
  }
};

// === Routes ===

formsRoute.post('/contact', async (c) => {
  const body = (await c.req.json()) as Partial<ContactInput>;

  const requiredFields = ['name', 'email', 'subject', 'message'] as const;

  const missing = requiredFields.filter(
    (key) => !body?.[key] || (typeof body[key] === 'string' && body[key].trim() === ''),
  );

  if (missing.length > 0) {
    logger.warn('Missing fields in contact form', { missing });
    return c.json(
      createFormError('validation', 'Missing fields', { missing }, { submittedAt: new Date().toISOString() }),
      400,
    );
  }

  const failure = await deliver(
    c,
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
    { replyTo: { name: body.name, email: body.email! } },
  );
  if (failure) return failure;

  return c.json<OkResponse>({ ok: true });
});

formsRoute.post('/counseling', async (c) => {
  const body = (await c.req.json()) as Partial<CounselingInput>;

  const requiredFields = ['name', 'email', 'subject', 'message'] as const;

  const missing = requiredFields.filter(
    (key) => !body?.[key] || (typeof body[key] === 'string' && body[key].trim() === ''),
  );

  if (missing.length > 0) {
    logger.warn('Missing fields in counseling form', { missing });
    return c.json(
      createFormError('validation', 'Missing fields', { missing }, { submittedAt: new Date().toISOString() }),
      400,
    );
  }

  const failure = await deliver(
    c,
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
    { replyTo: { name: body.name, email: body.email! } },
  );
  if (failure) return failure;

  return c.json<OkResponse>({ ok: true });
});

formsRoute.post('/feedback', async (c) => {
  const body = (await c.req.json()) as Partial<FeedbackInput>;

  const requiredFields = ['message'] as const;

  const missing = requiredFields.filter(
    (key) => !body?.[key] || (typeof body[key] === 'string' && body[key].trim() === ''),
  );

  if (missing.length > 0) {
    logger.warn('Missing fields in feedback form', { missing });
    return c.json(
      createFormError('validation', 'Missing fields', { missing }, { submittedAt: new Date().toISOString() }),
      400,
    );
  }

  const failure = await deliver(
    c,
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
    body.email ? { replyTo: { name: body.name, email: body.email! } } : undefined,
  );
  if (failure) return failure;

  return c.json<OkResponse>({ ok: true });
});

formsRoute.post('/prayer-request', async (c) => {
  const body = (await c.req.json()) as Partial<PrayerRequestInput>;

  const requiredFields = ['topic', 'description'] as const;

  const missing = requiredFields.filter(
    (key) => !body?.[key] || (typeof body[key] === 'string' && body[key].trim() === ''),
  );

  if (missing.length > 0) {
    logger.warn('Missing fields in prayer-request form', { missing });
    return c.json(
      createFormError('validation', 'Missing fields', { missing }, { submittedAt: new Date().toISOString() }),
      400,
    );
  }

  const failure = await deliver(
    c,
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
    body.email ? { replyTo: { name: body.displayName, email: body.email! } } : undefined,
  );
  if (failure) return failure;

  return c.json<OkResponse>({ ok: true });
});
