import { SEED } from '../support/api';
import { expect, test, waitForHydration } from '../support/test';

const { offer, episode } = SEED;

test.describe('home page', () => {
  test('shows the church and its main sections', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/Felsengrund/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Gottesdienstzeiten' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Gebetsanliegen', level: 2 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Parkplatz' })).toBeVisible();
  });

  test('teases the current offers from the API', async ({ page }) => {
    await page.goto('/');
    // The teaser only loads once it scrolls into view.
    await page.getByRole('heading', { name: 'Aktuelle Angebote' }).scrollIntoViewIfNeeded();
    await expect(page.getByRole('main').getByRole('link', { name: new RegExp(offer.title) })).toBeVisible();
  });
});

test.describe('navigation', () => {
  test('moves between the main pages with the header links', async ({ page }) => {
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Hauptnavigation' });

    await nav.getByRole('link', { name: 'Agenda' }).click();
    await expect(page).toHaveURL(/\/agenda\/?$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Agenda' })).toBeVisible();

    await nav.getByRole('link', { name: 'Podcast' }).click();
    await expect(page).toHaveURL(/\/podcast\/?$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Podcast' })).toBeVisible();

    await nav.getByRole('link', { name: 'Kontakt & Spenden' }).click();
    await expect(page).toHaveURL(/\/kontakt\/?$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Kontakt & Spenden' })).toBeVisible();

    await nav.getByRole('link', { name: 'Home' }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test('lists the offers in the Angebote dropdown and opens one', async ({ page }) => {
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Hauptnavigation' });

    await nav.getByRole('button', { name: 'Angebote' }).hover();
    const link = nav.getByRole('link', { name: offer.title });
    await expect(link).toBeVisible();
    await link.click();

    await expect(page).toHaveURL(new RegExp(`/angebote/${offer.slug}/?$`));
    await expect(page.getByRole('heading', { level: 1, name: offer.title })).toBeVisible();
  });

  test('works through the menu button on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto('/');

    const menuButton = page.getByRole('button', { name: 'Menü öffnen' });
    await menuButton.click();
    await expect(page.getByRole('button', { name: 'Menü schliessen' })).toHaveAttribute('aria-expanded', 'true');
    await page.getByRole('navigation', { name: 'Mobile Navigation' }).getByRole('link', { name: 'Agenda' }).click();

    await expect(page).toHaveURL(/\/agenda\/?$/);
  });

  test('shows the 404 page for unknown addresses', async ({ page }) => {
    const response = await page.goto('/gibt-es-nicht');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});

test.describe('agenda', () => {
  test('lists the recurring events', async ({ page }) => {
    await page.goto('/agenda');

    await expect(page.getByRole('heading', { level: 1, name: 'Agenda' })).toBeVisible();
    await expect(page.getByText('Sonntags, 09:45 - ca. 11:15 Uhr')).toBeVisible();
    await expect(page.getByText('Dinner Church').first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'nachzufragen' })).toHaveAttribute('href', /\/kontakt\?subject=/);
  });
});

test.describe('other static pages', () => {
  for (const { path, heading } of [
    { path: '/uber-uns', heading: /Über uns/ },
    { path: '/wegbeschreibung', heading: /Wegbeschreibung|Anfahrt/ },
    { path: '/datenschutz', heading: /Datenschutz/ },
    { path: '/ich-brauche-hilfe', heading: /Hilfe/ },
  ]) {
    test(`${path} renders`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole('heading', { level: 1 })).toContainText(heading);
    });
  }
});

test.describe('offers', () => {
  test('groups the offers by category', async ({ page }) => {
    await page.goto('/angebote');
    await waitForHydration(page);

    await expect(page.getByRole('heading', { level: 1, name: 'Angebote' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: offer.categoryLabel })).toBeVisible();
    const card = page.getByRole('link', { name: new RegExp(offer.title) });
    await expect(card).toContainText(offer.intro);
    await expect(card).toHaveAttribute('href', `/angebote/${offer.slug}`);
    // The card image is served by the Worker from its media route.
    await expect(card.getByRole('img', { name: offer.title })).toHaveJSProperty('complete', true);
    await expect(card.getByRole('img', { name: offer.title })).not.toHaveJSProperty('naturalWidth', 0);
  });

  test('always offers the help page in its category', async ({ page }) => {
    await page.goto('/angebote');
    await expect(page.getByRole('link', { name: /Ich brauche Hilfe/ })).toHaveAttribute('href', '/ich-brauche-hilfe');
  });

  test('opens an offer from the list and shows its details', async ({ page }) => {
    await page.goto('/angebote');
    await page.getByRole('link', { name: new RegExp(offer.title) }).click();

    await expect(page).toHaveURL(new RegExp(`/angebote/${offer.slug}/?$`));
    await expect(page.getByRole('heading', { level: 1, name: offer.title })).toBeVisible();
    await expect(page.getByText(offer.intro)).toBeVisible();
    await expect(page.getByRole('main').getByText(offer.categoryLabel, { exact: true })).toBeVisible();
    await expect(page.getByText(offer.schedule)).toBeVisible();
    await expect(page.getByText(offer.location)).toBeVisible();
    await expect(page.getByText(offer.targetAudience)).toBeVisible();
    await expect(page.getByText(offer.registration)).toBeVisible();
    await expect(page.getByText(offer.bodyText)).toBeVisible();
    await expect(page.getByRole('listitem').filter({ hasText: 'Zweiter Punkt' })).toBeVisible();
    await expect(page.getByText(offer.organizer.name)).toBeVisible();
    await expect(
      page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: 'Angebote' }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Kontaktformular' })).toHaveAttribute('href', /\/kontakt\?subject=/);
  });

  test('says so when an offer does not exist', async ({ page }) => {
    await page.goto('/angebote/gibt-es-nicht');
    await expect(page.getByRole('heading', { level: 1, name: 'Angebot nicht gefunden' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'alle Angebote' })).toHaveAttribute('href', '/angebote');
  });
});

test.describe('podcast', () => {
  test('lists the episodes', async ({ page }) => {
    await page.goto('/podcast');

    const entry = page.getByRole('listitem').filter({ hasText: episode.title });
    await expect(entry).toBeVisible();
    await expect(entry).toContainText(episode.speaker);
    await expect(entry).toContainText(episode.duration);
    await expect(entry.getByRole('link')).toHaveAttribute('href', `/podcast/${episode.slug}`);
  });

  test('opens an episode from the list and shows its details and player', async ({ page }) => {
    await page.goto('/podcast');
    await page.getByRole('link', { name: new RegExp(episode.title) }).click();

    await expect(page).toHaveURL(new RegExp(`/podcast/${episode.slug}/?$`));
    await expect(page.getByRole('heading', { level: 1, name: episode.title })).toBeVisible();
    await expect(page.getByText(`Folge ${episode.episodeNumber}`)).toBeVisible();
    await expect(page.getByText(episode.speaker)).toBeVisible();
    await expect(page.getByText(episode.bodyText)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Abspielen' })).toBeVisible();
    // The audio element points at the Worker's media route, which must actually serve the file.
    const src = await page.locator('audio').getAttribute('src');
    const audio = await page.request.get(src!);
    expect(audio.status()).toBe(200);
    expect(audio.headers()['content-type']).toBe('audio/mpeg');
  });

  test('says so when an episode does not exist', async ({ page }) => {
    await page.goto('/podcast/gibt-es-nicht');
    await expect(page.getByRole('heading', { level: 1, name: 'Episode nicht gefunden' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'alle Episoden' })).toHaveAttribute('href', '/podcast');
  });
});
