import { defineConfig } from 'vitest/config';
import { cloudflareTest } from '@cloudflare/vitest-plugin';

// Hermetic Worker environment: every secret and variable the tests rely on is set here as an explicit
// Miniflare binding, so the run does not depend on the machine. In particular a developer's own
// `apps/api/.dev.vars` (real passwords, recipient and origins) must never leak into the tests: values set in
// `process.env` are NOT enough, because the plugin lets `.dev.vars` win over them. The secrets are obviously
// fake; the origins match `wrangler.jsonc`, which the assertions expect.
// Runs the tests inside the Workers runtime (workerd via Miniflare). The R2 bucket (`STORAGE`) is
// Miniflare's local one, so nothing touches Cloudflare. The shared `packages/*` are covered here too,
// since the API imports them by source.
export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: {
        bindings: {
          ENVIRONMENT: 'local',
          KFA_SESSION_TTL_MS: '60000',
          KFA_ADMIN_PASSWORD: 'test-admin-password',
          KFA_MAIL_PASSWORD: 'test-mail-password',
          KFA_DEV_NOTIFICATION_RECIPIENT: 'dev-inbox@example.test',
          KFA_WORKER_ORIGIN: 'https://felsengrund.jroliveirahelder.workers.dev',
          KFA_WEBPAGE_ORIGIN: 'https://staging.kirche-felsengrund.ch',
          KFA_ALLOWED_ORIGINS: 'http://localhost:4321,https://*.kirche-felsengrund.ch',
        },
      },
    }),
  ],
  test: {
    include: ['test/**/*.test.ts'],
    setupFiles: ['test/setup.ts'],
  },
});
