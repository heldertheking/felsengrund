import type { Page } from '@playwright/test';
import { ADMIN_PASSWORD, API_URL, WEB_URL } from '../env.mjs';
import { audioFixturePath, deleteContent, imageFixturePath } from '../support/api';
import { expect, fieldByLabel, test, waitForHydration } from '../support/test';

async function logIn(page: Page): Promise<void> {
  await page.goto('/admin');
  await waitForHydration(page);
  await page.getByLabel('Passwort').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Angebote' })).toBeVisible();
}

/** Picks an image in the crop field, confirms the crop and waits for the preview. */
async function pickCroppedImage(page: Page, label: string): Promise<void> {
  await fieldByLabel(page, label).setInputFiles(imageFixturePath);
  const dialog = page.getByRole('dialog', { name: 'Bild zuschneiden' });
  await dialog.getByRole('button', { name: 'Zuschnitt übernehmen' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: 'Neues Bild verwerfen' })).toBeVisible();
}

/** Unique per test and per run, so parallel workers and repeated runs never collide on a slug. */
function uniqueTitle(prefix: string, parallelIndex: number): string {
  return `${prefix} ${Date.now().toString(36)}${parallelIndex}`;
}

test.describe('admin login', () => {
  test('rejects a wrong password', async ({ page }) => {
    await page.goto('/admin');
    await waitForHydration(page);
    await page.getByLabel('Passwort').fill('definitely-not-the-password');
    await page.getByRole('button', { name: 'Anmelden' }).click();

    await expect(page.getByRole('alert')).toHaveText('Falsches Passwort.');
    await expect(page.getByRole('heading', { level: 1, name: 'Kirche Felsengrund - Admin' })).toBeVisible();
  });

  test('logs in, stays logged in after a reload and logs out again', async ({ page }) => {
    await logIn(page);

    await page.reload();
    await expect(page.getByRole('heading', { level: 2, name: 'Angebote' })).toBeVisible();

    await page.getByRole('button', { name: 'Abmelden' }).click();
    await expect(page.getByLabel('Passwort')).toBeVisible();

    await page.reload();
    await expect(page.getByLabel('Passwort')).toBeVisible();
  });

  test('refuses admin API calls without a valid token', async ({ request }) => {
    const origin = { Origin: WEB_URL };
    const anonymous = await request.post(`${API_URL}/admin/offers`, {
      headers: origin,
      form: { title: 'Sneaky', category: 'sonstiges' },
    });
    expect(anonymous.status()).toBe(401);
    const forged = await request.delete(`${API_URL}/admin/offers/whatever`, {
      headers: { ...origin, Authorization: 'Bearer forged.token' },
    });
    expect(forged.status()).toBe(401);
  });
});

test.describe('offers admin', () => {
  test('creates, edits and deletes an offer that shows up on the public site', async ({ page }, testInfo) => {
    const title = uniqueTitle('E2E Admin Angebot', testInfo.parallelIndex);
    let slug: string | undefined;

    try {
      await logIn(page);

      // Create
      await page.getByRole('button', { name: 'Neues Angebot' }).click();
      await expect(page.getByRole('heading', { level: 2, name: 'Neues Angebot' })).toBeVisible();
      await fieldByLabel(page, 'Titel').fill(title);
      await fieldByLabel(page, 'Intro').fill('Erste Fassung des Intros.');
      await fieldByLabel(page, 'Kategorie').selectOption({ label: 'Senioren' });
      await fieldByLabel(page, 'Zeiten').fill('Jeden Dienstag');
      await fieldByLabel(page, 'Ort').fill('Gemeindesaal');
      await page.getByRole('button', { name: 'Ansprechperson hinzufügen' }).click();
      await page.getByPlaceholder('Name').fill('Hans Beispiel');
      await pickCroppedImage(page, 'Kartenbild');
      await fieldByLabel(page, 'Inhalt (Markdoc)').fill('Ein **wichtiger** Hinweis.');

      const created = page.waitForResponse(
        (response) => response.url() === `${API_URL}/admin/offers` && response.request().method() === 'POST',
      );
      await page.getByRole('button', { name: 'Speichern' }).click();
      const createResponse = await created;
      expect(createResponse.status()).toBe(200);
      slug = ((await createResponse.json()) as { slug: string }).slug;

      const row = page.getByRole('listitem').filter({ hasText: title });
      await expect(row).toBeVisible();
      await expect(row).toContainText(slug);

      // The public site shows it, including the cropped card image served by the Worker.
      const publicPage = await page.context().newPage();
      await publicPage.goto(`/angebote/${slug}`);
      await expect(publicPage.getByRole('heading', { level: 1, name: title })).toBeVisible();
      await expect(publicPage.getByText('Erste Fassung des Intros.')).toBeVisible();
      await expect(publicPage.getByText('Jeden Dienstag')).toBeVisible();
      await expect(publicPage.getByText('Hans Beispiel')).toBeVisible();
      await expect(publicPage.locator('strong', { hasText: 'wichtiger' })).toBeVisible();
      await expect(publicPage.getByRole('img', { name: title })).not.toHaveJSProperty('naturalWidth', 0);

      // Edit
      await row.getByRole('button', { name: 'Bearbeiten' }).click();
      await expect(page.getByRole('heading', { level: 2, name: 'Angebot bearbeiten' })).toBeVisible();
      await expect(fieldByLabel(page, 'Titel')).toHaveValue(title);
      await expect(fieldByLabel(page, 'Intro')).toHaveValue('Erste Fassung des Intros.');
      await fieldByLabel(page, 'Intro').fill('Zweite Fassung des Intros.');
      await page.getByRole('button', { name: 'Speichern' }).click();
      await expect(page.getByRole('heading', { level: 2, name: 'Angebote' })).toBeVisible();

      await publicPage.reload();
      await expect(publicPage.getByText('Zweite Fassung des Intros.')).toBeVisible();
      await expect(publicPage.getByText('Erste Fassung des Intros.')).toBeHidden();
      // The image survives an edit that does not touch it.
      await expect(publicPage.getByRole('img', { name: title })).not.toHaveJSProperty('naturalWidth', 0);

      // Delete
      page.once('dialog', (dialog) => dialog.accept());
      await page.getByRole('listitem').filter({ hasText: title }).getByRole('button', { name: 'Löschen' }).click();
      await expect(page.getByRole('listitem').filter({ hasText: title })).toHaveCount(0);

      await publicPage.reload();
      await expect(publicPage.getByRole('heading', { level: 1, name: 'Angebot nicht gefunden' })).toBeVisible();
    } finally {
      if (slug) await deleteContent('offers', slug);
    }
  });

  test('does not create an offer without a title', async ({ page }) => {
    await logIn(page);
    await page.getByRole('button', { name: 'Neues Angebot' }).click();

    let posts = 0;
    await page.route(`${API_URL}/admin/offers`, (route) => {
      if (route.request().method() === 'POST') posts++;
      return route.fallback();
    });
    await page.getByRole('button', { name: 'Speichern' }).click();

    await expect
      .poll(() => fieldByLabel(page, 'Titel').evaluate((el) => (el as HTMLInputElement).validity.valueMissing))
      .toBe(true);
    expect(posts).toBe(0);
  });
});

test.describe('podcast admin', () => {
  test('creates, edits and deletes an episode that shows up on the public site', async ({ page }, testInfo) => {
    const title = uniqueTitle('E2E Admin Episode', testInfo.parallelIndex);
    let slug: string | undefined;

    try {
      await logIn(page);
      await page.getByRole('button', { name: 'Podcast' }).click();
      await expect(page.getByRole('heading', { level: 2, name: 'Podcast' })).toBeVisible();

      // Create: the audio file is required.
      await page.getByRole('button', { name: 'Neue Episode' }).click();
      await expect(page.getByRole('heading', { level: 2, name: 'Neue Episode' })).toBeVisible();
      await fieldByLabel(page, 'Titel').fill(title);
      await fieldByLabel(page, 'Veröffentlichungsdatum').fill('2026-02-01');
      await fieldByLabel(page, 'Audiodatei (erforderlich)').setInputFiles(audioFixturePath);
      // Choosing the audio file reads its length from the file itself.
      await expect(fieldByLabel(page, 'Dauer (z. B. 32:10)')).toHaveValue(/^\d+:\d{2}$/);
      await page.getByRole('button', { name: 'Sprecher hinzufügen' }).click();
      await page.getByPlaceholder('Name').fill('Paula Prediger');
      await pickCroppedImage(page, 'Cover-Bild');
      await fieldByLabel(page, 'Shownotes (Markdoc)').fill('Die **Shownotes** der Episode.');

      const created = page.waitForResponse(
        (response) => response.url() === `${API_URL}/admin/podcast` && response.request().method() === 'POST',
      );
      await page.getByRole('button', { name: 'Speichern' }).click();
      const createResponse = await created;
      expect(createResponse.status()).toBe(200);
      slug = ((await createResponse.json()) as { slug: string }).slug;

      const row = page.getByRole('listitem').filter({ hasText: title });
      await expect(row).toBeVisible();

      const publicPage = await page.context().newPage();
      await publicPage.goto(`/podcast/${slug}`);
      await expect(publicPage.getByRole('heading', { level: 1, name: title })).toBeVisible();
      await expect(publicPage.getByText('Paula Prediger')).toBeVisible();
      await expect(publicPage.locator('strong', { hasText: 'Shownotes' })).toBeVisible();
      await expect(publicPage.getByRole('img', { name: title })).not.toHaveJSProperty('naturalWidth', 0);
      const audioSrc = await publicPage.locator('audio').getAttribute('src');
      expect((await publicPage.request.get(audioSrc!)).status()).toBe(200);

      // Edit: keeps the audio file when none is chosen.
      await row.getByRole('button', { name: 'Bearbeiten' }).click();
      await expect(page.getByRole('heading', { level: 2, name: 'Episode bearbeiten' })).toBeVisible();
      await expect(fieldByLabel(page, 'Titel')).toHaveValue(title);
      await fieldByLabel(page, 'Shownotes (Markdoc)').fill('Überarbeitete Shownotes.');
      await page.getByRole('button', { name: 'Speichern' }).click();
      await expect(page.getByRole('heading', { level: 2, name: 'Podcast' })).toBeVisible();

      await publicPage.reload();
      await expect(publicPage.getByText('Überarbeitete Shownotes.')).toBeVisible();
      expect((await publicPage.request.get(audioSrc!)).status()).toBe(200);

      // Delete
      page.once('dialog', (dialog) => dialog.accept());
      await page.getByRole('listitem').filter({ hasText: title }).getByRole('button', { name: 'Löschen' }).click();
      await expect(page.getByRole('listitem').filter({ hasText: title })).toHaveCount(0);

      await publicPage.reload();
      await expect(publicPage.getByRole('heading', { level: 1, name: 'Episode nicht gefunden' })).toBeVisible();
    } finally {
      if (slug) await deleteContent('podcast', slug);
    }
  });

  test('needs an audio file for a new episode', async ({ page }) => {
    await logIn(page);
    await page.getByRole('button', { name: 'Podcast' }).click();
    await page.getByRole('button', { name: 'Neue Episode' }).click();
    await fieldByLabel(page, 'Titel').fill('Ohne Audio');
    await fieldByLabel(page, 'Veröffentlichungsdatum').fill('2026-02-01');
    await page.getByRole('button', { name: 'Speichern' }).click();

    await expect
      .poll(() =>
        fieldByLabel(page, 'Audiodatei (erforderlich)').evaluate(
          (el) => (el as HTMLInputElement).validity.valueMissing,
        ),
      )
      .toBe(true);
  });
});
