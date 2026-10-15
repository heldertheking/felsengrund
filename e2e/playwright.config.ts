import { defineConfig, devices } from '@playwright/test';
import { API_URL, ROOT_DIR, WEB_URL } from './env.mjs';

const isCI = Boolean(process.env.CI);

/**
 * The stack under test is the production build of the site (`astro build` + `astro preview`) talking to the real Worker
 * (`wrangler dev`). A build, rather than `astro dev`, because it is what actually ships: no on-demand dependency
 * optimisation that reloads the page mid-test, and no dev overlay. `PUBLIC_API_BASE_URL` is inlined at build time.
 *
 * Both servers are always started fresh (`reuseExistingServer: false`) so a test run can never attach to, or write into,
 * a developer's own `npm run dev` stack. Ports: E2E_WEB_PORT (4400), E2E_API_PORT (8790), E2E_INSPECTOR_PORT (9330).
 */
export default defineConfig({
  testDir: './tests',
  globalSetup: './support/global-setup.ts',
  globalTeardown: './support/global-teardown.ts',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 2 : undefined,
  // `list` prints a "flaky" summary for tests that only passed on a retry, so retries cannot hide a flake silently.
  reporter: isCI ? [['list'], ['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: WEB_URL,
    locale: 'de-CH',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      name: 'api',
      command: 'node e2e/scripts/start-api.mjs',
      cwd: ROOT_DIR,
      url: API_URL,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      name: 'web',
      command: 'node e2e/scripts/start-web.mjs',
      cwd: ROOT_DIR,
      url: WEB_URL,
      reuseExistingServer: false,
      timeout: 300_000,
    },
  ],
});
