import type { MiddlewareHandler } from 'hono';
import { createLogger } from '@felsengrund/logger';
import type { Env } from '../types';

const logger = createLogger('env-check');

// Wrangler doesn't inherit top-level vars/bindings into named environments - each env block
// must repeat every one, or requests fail with an unhelpful generic error. This turns that
// into one clear log line naming what's missing.
const REQUIRED_VARS: (keyof Env)[] = ['ENVIRONMENT', 'KFA_WORKER_ORIGIN', 'KFA_WEBPAGE_ORIGIN', 'KFA_ALLOWED_ORIGINS'];

let lastCheckedEnv: Env | undefined;

export const checkRequiredBindings: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  if (c.env !== lastCheckedEnv) {
    lastCheckedEnv = c.env;
    const missing: string[] = [
      ...REQUIRED_VARS.filter((key) => !c.env[key]),
      ...(c.env.STORAGE ? [] : ['STORAGE (R2 bucket)']),
    ];

    if (missing.length > 0) {
      logger.error('Worker is missing required bindings - check wrangler.jsonc env overrides', {
        environment: c.env.ENVIRONMENT ?? '<unset>',
        missing,
      });
    }
  }

  await next();
};
