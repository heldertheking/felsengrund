import { API_URL, WEB_URL } from '../env.mjs';
import { login, SEED } from '../support/api';
import { expect, test } from '../support/test';

// A developer's apps/api/.dev.vars is loaded by wrangler, but start-api.mjs overrides every variable it may define
// with `--var`. These tests hold whichever file is present (including none) to the E2E values, so a local file can
// neither redirect media, enable mail nor change the admin password. They were verified against a fake .dev.vars with
// different values for every variable.

test('the Worker uses the E2E configuration, not a local .dev.vars', async ({ request }) => {
  const info = await request.get(API_URL, { headers: { Origin: WEB_URL } });
  expect((await info.json()).environment).toBe('local');

  // Admin password from the E2E stack (global setup already logged in with it).
  expect(await login()).toBeTruthy();

  // Media URLs are built from KFA_WORKER_ORIGIN and must point at the E2E Worker.
  const offers = (await (await request.get(`${API_URL}/offers`, { headers: { Origin: WEB_URL } })).json()) as {
    slug: string;
    data: { cardImage?: string };
  }[];
  const seeded = offers.find((offer) => offer.slug === SEED.offer.slug);
  expect(seeded?.data.cardImage).toMatch(new RegExp(`^${API_URL}/media/`));
});
