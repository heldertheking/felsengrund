import { Hono } from 'hono';
import { isFormId, validateForm, type ErrorResponse, type FormPayload, type OkResponse } from '@felsengrund/types';
import type { Env } from '../types';
import { NotificationService } from '../lib/mail';
import { buildFormNotification } from '../lib/form-notifications';

export const formsRoute = new Hono<{ Bindings: Env }>();

// Built once, shared by every request - the mailer config doesn't depend on a request.
const notificationService = new NotificationService();

/**
 * The one endpoint for every public form: `{ id, payload }`.
 * Forms are registered in `@felsengrund/types` (Forms.ts) and `lib/form-notifications.ts`.
 */
formsRoute.post('/forms', async (c) => {
  const body = await c.req.json<{ id?: unknown; payload?: unknown }>().catch(() => null);
  const { id, payload } = body ?? {};

  if (!isFormId(id)) {
    return c.json<ErrorResponse>({ error: 'Unbekanntes Formular.' }, 400);
  }
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return c.json<ErrorResponse>({ error: 'Fehlende Angaben.' }, 400);
  }

  const error = validateForm(id, payload as FormPayload);
  if (error) {
    return c.json<ErrorResponse>({ error }, 400);
  }

  const { subject, content, mailbox, options } = buildFormNotification(id, payload as FormPayload);
  await notificationService.send(subject, content, mailbox, c.env, options);

  return c.json<OkResponse>({ ok: true });
});
