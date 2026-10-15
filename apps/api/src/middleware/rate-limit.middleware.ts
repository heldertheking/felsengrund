import type { MiddlewareHandler } from 'hono';
import { createLogger } from '@felsengrund/logger';
import { createFormError, type Env } from '../types';

const logger = createLogger('rate-limit');

/** The Workers Rate Limiting binding allows periods of 10 or 60 seconds; this is the length of the configured one. */
const RETRY_AFTER_SECONDS = '60';

/**
 * Per-client limit for `POST /forms`: every accepted submission sends an email through the church's SMTP account,
 * so an unlimited public endpoint can be used to flood the mailboxes. The client is identified by Cloudflare's
 * `CF-Connecting-IP`. The limit (and its period) live in `wrangler.jsonc` (`ratelimits`).
 *
 * Enforced on deployed environments only: local development, the unit tests and the E2E suite run as
 * `ENVIRONMENT=local` and submit many forms from one address on purpose. If a deployed environment has no limiter
 * binding the request goes through (a missing binding must not take the forms down) and the gap is logged.
 */
export const formsRateLimit: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  if (c.env.ENVIRONMENT === 'local') return next();

  const limiter = c.env.FORMS_RATE_LIMITER;
  if (!limiter) {
    logger.error('FORMS_RATE_LIMITER binding is missing - POST /forms is not rate limited', {
      environment: c.env.ENVIRONMENT,
    });
    return next();
  }

  const client = c.req.header('cf-connecting-ip') ?? 'unknown';
  const { success } = await limiter.limit({ key: client });
  if (!success) {
    logger.warn('Form submission rate limited', { client });
    c.header('Retry-After', RETRY_AFTER_SECONDS);
    return c.json(createFormError('unknown', 'Zu viele Anfragen. Bitte versuche es in einer Minute erneut.'), 429);
  }

  return next();
};
