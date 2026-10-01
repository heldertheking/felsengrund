import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { formValidators, validateForm, type FormId, type OkResponse } from '@felsengrund/types';
import { createLogger } from '@felsengrund/logger';
import { createFormError, type Env } from '../types';
import { NotificationService } from '../lib';
import { buildFormNotification } from '../lib/form-notifications';

// === Setup ===
const logger = createLogger('Forms Route');
const notificationService = new NotificationService();

/** Envelope only. The per-form field checks live in `formValidators` (`@felsengrund/types`). */
const submissionSchema = z.object({
  id: z.enum(Object.keys(formValidators) as [FormId, ...FormId[]]),
  payload: z.record(z.string(), z.union([z.string(), z.array(z.string())])),
});

// === Routes ===

/**
 * The one endpoint for every public form: `{ id, payload }`.
 * Forms are registered in `@felsengrund/types` (Forms.ts) and `lib/form-notifications.ts`.
 */
export const formsRoute = new Hono<{ Bindings: Env }>().post(
  '/forms',
  zValidator('json', submissionSchema, (result, c) => {
    if (!result.success) {
      logger.warn('Malformed form submission', { issues: result.error.issues });
      return c.json(createFormError('validation', 'Unknown form or malformed payload'), 400);
    }
  }),
  async (c) => {
    const { id, payload } = c.req.valid('json');

    const error = validateForm(id, payload);
    if (error) {
      logger.warn('Form validation failed', { id, error });
      return c.json(createFormError('validation', error, undefined, { submittedAt: new Date().toISOString() }), 400);
    }

    const { subject, content, mailbox, options } = buildFormNotification(id, payload);
    try {
      await notificationService.send(subject, content, mailbox, c.env, options);
    } catch (sendError) {
      logger.error('failed to send notification email', { id, error: sendError });
      return c.json(createFormError('sending', 'Failed to send notification'), 502);
    }

    return c.json<OkResponse>({ ok: true });
  },
);
