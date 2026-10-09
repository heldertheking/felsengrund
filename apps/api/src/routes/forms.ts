import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { FormInputs, OkResponse } from '@felsengrund/types';
import { FORM_IDS, FORM_INVALID_MESSAGE, formSchemas } from '@felsengrund/types/forms';
import { createLogger } from '@felsengrund/logger';
import { createFormError, type Env } from '../types';
import { NotificationService } from '../lib';
import { buildFormNotification } from '../lib/form-notifications';

// === Setup ===
const logger = createLogger('Forms Route');
const notificationService = new NotificationService();

/** Envelope only. The per-form field checks live in `formSchemas` (`@felsengrund/types/forms`). */
const submissionSchema = z.object({
  id: z.enum(FORM_IDS),
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

    const parsed = formSchemas[id].safeParse(payload);
    if (!parsed.success) {
      logger.warn('Form validation failed', { id, issues: parsed.error.issues });
      return c.json(
        createFormError('validation', FORM_INVALID_MESSAGE, undefined, { submittedAt: new Date().toISOString() }),
        400,
      );
    }

    // `formSchemas[id]` is a union over all forms, so TS can't correlate `id` with the parsed shape.
    const notification = buildFormNotification(id, parsed.data as FormInputs[typeof id]);
    try {
      await notificationService.send(notification, c.env);
    } catch (sendError) {
      logger.error('failed to send notification email', { id, error: sendError });
      return c.json(createFormError('sending', 'Failed to send notification'), 502);
    }

    return c.json<OkResponse>({ ok: true });
  },
);
