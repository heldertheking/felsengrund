import { Hono } from 'hono';
import { isFormId, validateForm, type FormPayload, type OkResponse } from '@felsengrund/types';
import { createLogger } from '@felsengrund/logger';
import { createFormError, type Env } from '../types';
import { NotificationService } from '../lib';
import { buildFormNotification } from '../lib/form-notifications';

// === Setup ===
export const formsRoute = new Hono<{ Bindings: Env }>();
const logger = createLogger('Forms Route');
const notificationService = new NotificationService();

// === Routes ===

/**
 * The one endpoint for every public form: `{ id, payload }`.
 * Forms are registered in `@felsengrund/types` (Forms.ts) and `lib/form-notifications.ts`.
 */
formsRoute.post('/forms', async (c) => {
  const body = await c.req.json<{ id?: unknown; payload?: unknown }>().catch(() => null);
  const { id, payload } = body ?? {};

  if (!isFormId(id)) {
    logger.warn('Submission for unknown form id', { id });
    return c.json(createFormError('validation', 'Unknown form'), 400);
  }
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    logger.warn('Submission without a payload object', { id });
    return c.json(createFormError('validation', 'Missing payload'), 400);
  }

  const error = validateForm(id, payload as FormPayload);
  if (error) {
    logger.warn('Form validation failed', { id, error });
    return c.json(createFormError('validation', error, undefined, { submittedAt: new Date().toISOString() }), 400);
  }

  const { subject, content, mailbox, options } = buildFormNotification(id, payload as FormPayload);
  try {
    await notificationService.send(subject, content, mailbox, c.env, options);
  } catch (sendError) {
    logger.error('failed to send notification email', { id, error: sendError });
    return c.json(createFormError('sending', 'Failed to send notification'), 502);
  }

  return c.json<OkResponse>({ ok: true });
});
