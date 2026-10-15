import { defineConfig } from 'vitest/config';
import { cloudflareTest } from '@cloudflare/vitest-plugin';

// Hermetic secrets: the plugin reads Worker secrets from `process.env`. These are obviously fake
// values, never real credentials, and they override anything set in the developer's shell.
process.env.KFA_ADMIN_PASSWORD = 'test-admin-password';
process.env.KFA_MAIL_PASSWORD = 'test-mail-password';
process.env.KFA_DEV_NOTIFICATION_RECIPIENT = 'dev-inbox@example.test';

// Runs the tests inside the Workers runtime (workerd via Miniflare). The R2 bucket (`STORAGE`) is
// Miniflare's local one, so nothing touches Cloudflare. The shared `packages/*` are covered here too,
// since the API imports them by source.
export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: {
        bindings: { ENVIRONMENT: 'local', KFA_SESSION_TTL_MS: '60000' },
      },
    }),
  ],
  test: {
    include: ['test/**/*.test.ts'],
    setupFiles: ['test/setup.ts'],
  },
});
