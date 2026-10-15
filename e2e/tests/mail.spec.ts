import { readFile } from 'node:fs/promises';
import { API_LOG, API_URL, WEB_URL } from '../env.mjs';
import { expect, test } from '../support/test';

// The E2E Worker runs as ENVIRONMENT=local with no KFA_DEV_NOTIFICATION_RECIPIENT. In that configuration the
// NotificationService logs "skipping notification email" and returns before it ever opens an SMTP connection
// (apps/api/src/lib/notification/index.ts). These tests pin that down, so a change which would start mailing real
// people from the test stack fails the suite.

async function workerLog(): Promise<string> {
  return readFile(API_LOG, 'utf8');
}

test('the test Worker is not running as production', async ({ request }) => {
  const response = await request.get(API_URL, { headers: { Origin: WEB_URL } });
  expect((await response.json()).environment).toBe('local');
});

test('a form submission is accepted without any mail being sent', async ({ request }) => {
  const marker = `mail-check-${Date.now()}`;
  const before = (await workerLog()).split('skipping notification email').length;

  const response = await request.post(`${API_URL}/forms`, {
    headers: { Origin: WEB_URL },
    data: {
      id: 'contact',
      payload: { name: marker, email: 'mail-check@example.com', subject: 'Mail check', message: 'Nothing is sent.' },
    },
  });
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ ok: true });

  // The log is written asynchronously, so poll instead of sleeping.
  await expect
    .poll(async () => (await workerLog()).split('skipping notification email').length)
    .toBeGreaterThan(before);

  const log = await workerLog();
  expect(log).not.toContain('Failed to send notification');
  expect(log).not.toContain('failed to send notification email');
  expect(log).not.toContain('redirecting notification email');
  expect(log).not.toMatch(/worker-?mailer|smtp|mail\.webkeeper/i);
});
