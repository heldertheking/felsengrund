import type { MiddlewareHandler } from 'hono';
import { createLogger } from '@felsengrund/logger';
import type { Env } from '../types';

const logger = createLogger('env-check');

// Wrangler does NOT inherit top-level `vars`/`r2_buckets`/bound secrets into named environments
// (`env.production`, `env.development` in wrangler.jsonc) - each env block has to repeat every
// binding it needs. Missing one deploys fine but fails every request that touches it, surfacing
// only as a generic "Cannot read properties of undefined" deep inside application code. Checking
// upfront turns that into one clear log line naming exactly which binding is missing.
const REQUIRED_VARS: (keyof Env)[] = [
  'ENVIRONMENT',
  'KFA_WORKER_ORIGIN',
  'KFA_WEBPAGE_ORIGIN',
  'KFA_ALLOWED_ORIGINS',
  'KFA_NOTIFICATION_WEBHOOK',
];

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
