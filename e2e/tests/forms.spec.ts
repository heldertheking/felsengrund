import type { Locator, Page } from '@playwright/test';
import { API_URL } from '../env.mjs';
import { expect, test, waitForFormRequest } from '../support/test';

const REQUIRED = 'Bitte fülle dieses Feld aus.';
const INVALID_FIELDS = 'Bitte überprüfe die markierten Felder.';
const DEFAULT_SUCCESS = 'Danke - wir haben deine Nachricht erhalten.';
const DEFAULT_ERROR = 'Das hat leider nicht geklappt. Bitte versuche es später erneut.';

/** The form that owns the given submit button (the home page has two forms). */
function formWith(page: Page, submitLabel: string): Locator {
  return page.locator('form[data-base-form]').filter({ has: page.getByRole('button', { name: submitLabel }) });
}

/** Clicks submit and resolves with the request the site sent to the API and the Worker's response status. */
async function submit(form: Locator, submitLabel: string) {
  const page = form.page();
  const requestPromise = waitForFormRequest(page);
  await form.getByRole('button', { name: submitLabel }).click();
  const request = await requestPromise;
  const response = await request.response();
  return {
    body: request.postDataJSON() as { id: string; payload: Record<string, unknown> },
    status: response?.status(),
  };
}

test.describe('contact form', () => {
  const submitLabel = 'Absenden';

  test('sends the message and confirms it', async ({ page }) => {
    await page.goto('/kontakt');
    const form = page.getByRole('form', { name: 'contact form' });
    await form.getByRole('textbox', { name: 'Name' }).fill('Erika Muster');
    await form.getByRole('textbox', { name: 'Email' }).fill('erika@example.com');
    await form.getByRole('textbox', { name: 'Betreff' }).fill('Eine Frage');
    await form.getByRole('textbox', { name: 'Nachricht' }).fill('Hallo, wann ist der nächste Gottesdienst?');

    const { body, status } = await submit(form, submitLabel);

    expect(status).toBe(200);
    expect(body).toEqual({
      id: 'contact',
      payload: {
        name: 'Erika Muster',
        email: 'erika@example.com',
        subject: 'Eine Frage',
        message: 'Hallo, wann ist der nächste Gottesdienst?',
      },
    });
    await expect(form.getByRole('status')).toHaveText(DEFAULT_SUCCESS);
    // A successful send clears the form for the next message.
    await expect(form.getByRole('textbox', { name: 'Name' })).toHaveValue('');
  });

  test('flags every empty required field and sends nothing', async ({ page }) => {
    let posts = 0;
    await page.route(`${API_URL}/forms`, (route) => {
      if (route.request().method() === 'POST') posts++;
      return route.fallback();
    });
    await page.goto('/kontakt');
    const form = page.getByRole('form', { name: 'contact form' });

    await form.getByRole('button', { name: submitLabel }).click();

    await expect(form.getByRole('alert')).toHaveText(INVALID_FIELDS);
    for (const label of ['Name', 'Email', 'Betreff', 'Nachricht']) {
      const field = form.getByRole('textbox', { name: label });
      await expect(field).toHaveAttribute('aria-invalid', 'true');
      await expect(field).toHaveAccessibleDescription(REQUIRED);
    }
    await expect(form.getByRole('textbox', { name: 'Name' })).toBeFocused();

    // Fixing a flagged field clears its error right away.
    await form.getByRole('textbox', { name: 'Name' }).fill('Erika');
    await expect(form.getByRole('textbox', { name: 'Name' })).not.toHaveAttribute('aria-invalid', 'true');
    expect(posts).toBe(0);
  });

  test('prefills the subject from the link', async ({ page }) => {
    await page.goto('/kontakt?subject=frage%20zum%20Podcast');
    await expect(
      page.getByRole('form', { name: 'contact form' }).getByRole('textbox', { name: 'Betreff' }),
    ).toHaveValue('Frage zum Podcast');
  });

  test('shows an error when the Worker rejects the message and keeps what was typed', async ({ page }) => {
    await page.goto('/kontakt');
    const form = page.getByRole('form', { name: 'contact form' });
    await form.getByRole('textbox', { name: 'Name' }).fill('Erika Muster');
    // Passes the browser's checks (the field is a plain text input) but not the Worker's address check.
    await form.getByRole('textbox', { name: 'Email' }).fill('not-an-email-address');
    await form.getByRole('textbox', { name: 'Betreff' }).fill('Eine Frage');
    await form.getByRole('textbox', { name: 'Nachricht' }).fill('Hallo');

    const { status } = await submit(form, submitLabel);

    expect(status).toBe(400);
    await expect(form.getByRole('alert')).toHaveText(DEFAULT_ERROR);
    await expect(form.getByRole('textbox', { name: 'Nachricht' })).toHaveValue('Hallo');
  });

  test('shows an error when the Worker cannot send the notification', async ({ page }) => {
    await page.route(`${API_URL}/forms`, (route) =>
      route.request().method() === 'POST'
        ? route.fulfill({
            status: 502,
            contentType: 'application/json',
            json: { status: 'fail', type: 'sending', message: 'Failed to send notification' },
            headers: { 'Access-Control-Allow-Origin': '*' },
          })
        : route.fallback(),
    );
    await page.goto('/kontakt');
    const form = page.getByRole('form', { name: 'contact form' });
    await form.getByRole('textbox', { name: 'Name' }).fill('Erika Muster');
    await form.getByRole('textbox', { name: 'Email' }).fill('erika@example.com');
    await form.getByRole('textbox', { name: 'Betreff' }).fill('Eine Frage');
    await form.getByRole('textbox', { name: 'Nachricht' }).fill('Hallo');

    await form.getByRole('button', { name: submitLabel }).click();

    await expect(form.getByRole('alert')).toHaveText(DEFAULT_ERROR);
    await expect(form.getByRole('textbox', { name: 'Name' })).toHaveValue('Erika Muster');
    await expect(form.getByRole('button', { name: submitLabel })).toHaveAttribute('aria-disabled', 'false');
  });

  test('silently drops submissions that fill the honeypot', async ({ page }) => {
    let posts = 0;
    await page.route(`${API_URL}/forms`, (route) => {
      if (route.request().method() === 'POST') posts++;
      return route.fallback();
    });
    await page.goto('/kontakt');
    const form = page.getByRole('form', { name: 'contact form' });
    await form.getByRole('textbox', { name: 'Name' }).fill('Bot');
    await form.getByRole('textbox', { name: 'Email' }).fill('bot@example.com');
    await form.getByRole('textbox', { name: 'Betreff' }).fill('Spam');
    await form.getByRole('textbox', { name: 'Nachricht' }).fill('Spam');
    await form.locator('[data-honeypot]').fill('http://spam.example', { force: true });

    await form.getByRole('button', { name: submitLabel }).click();

    await expect(form.getByRole('status')).toHaveText(DEFAULT_SUCCESS);
    expect(posts).toBe(0);
  });
});

test.describe('counseling form', () => {
  const submitLabel = 'Absenden';

  test.beforeEach(async ({ page }) => {
    await page.goto('/lebensberatung');
  });

  test('only asks for the contact detail that matches the chosen contact method', async ({ page }) => {
    const form = formWith(page, submitLabel);
    const email = form.getByRole('textbox', { name: 'E-Mail' });
    const phone = form.getByRole('textbox', { name: 'Telefon' });
    await expect(email).toBeHidden();
    await expect(phone).toBeHidden();

    await form.getByRole('radio', { name: 'Telefon' }).check();
    await expect(phone).toBeVisible();
    await expect(phone).toBeEnabled();
    await expect(email).toBeHidden();

    await form.getByRole('radio', { name: 'E-Mail' }).check();
    await expect(email).toBeVisible();
    await expect(phone).toBeHidden();
  });

  test('requires the contact method and the detail that belongs to it', async ({ page }) => {
    const form = formWith(page, submitLabel);
    await form.getByRole('textbox', { name: 'Name' }).fill('Erika Muster');
    await form.getByRole('textbox', { name: 'Thema' }).fill('Stress');
    await form.getByRole('textbox', { name: 'Nachricht' }).fill('Ich möchte reden.');

    await form.getByRole('button', { name: submitLabel }).click();
    await expect(form.getByRole('group', { name: 'Bevorzugte Kontaktart' })).toHaveAttribute('aria-invalid', 'true');
    await expect(form.getByRole('alert')).toHaveText(INVALID_FIELDS);

    await form.getByRole('radio', { name: 'E-Mail' }).check();
    await form.getByRole('button', { name: submitLabel }).click();
    await expect(form.getByRole('textbox', { name: 'E-Mail' })).toHaveAttribute('aria-invalid', 'true');

    await form.getByRole('textbox', { name: 'E-Mail' }).fill('kein-mail');
    await form.getByRole('button', { name: submitLabel }).click();
    await expect(form.getByRole('textbox', { name: 'E-Mail' })).toHaveAccessibleDescription(
      'Bitte gib eine gültige E-Mail-Adresse ein.',
    );
  });

  test('sends a request by phone, without the hidden e-mail field', async ({ page }) => {
    const form = formWith(page, submitLabel);
    await form.getByRole('textbox', { name: 'Name' }).fill('Erika Muster');
    await form.getByRole('textbox', { name: 'Thema' }).fill('Stress');
    await form.getByRole('textbox', { name: 'Nachricht' }).fill('Ich möchte reden.');
    await form.getByRole('radio', { name: 'Telefon' }).check();
    await form.getByRole('textbox', { name: 'Telefon' }).fill('044 123 45 67');
    await form.getByRole('radio', { name: 'Weiblich' }).check();

    const { body, status } = await submit(form, submitLabel);

    expect(status).toBe(200);
    expect(body).toEqual({
      id: 'counseling',
      payload: {
        name: 'Erika Muster',
        subject: 'Stress',
        message: 'Ich möchte reden.',
        contactPreference: 'phone',
        phone: '044 123 45 67',
        counselorPreference: 'female',
      },
    });
    await expect(form.getByRole('status')).toHaveText(DEFAULT_SUCCESS);
  });

  test('sends a request by e-mail', async ({ page }) => {
    const form = formWith(page, submitLabel);
    await form.getByRole('textbox', { name: 'Name' }).fill('Erika Muster');
    await form.getByRole('textbox', { name: 'Thema' }).fill('Stress');
    await form.getByRole('textbox', { name: 'Nachricht' }).fill('Ich möchte reden.');
    await form.getByRole('radio', { name: 'E-Mail' }).check();
    await form.getByRole('textbox', { name: 'E-Mail' }).fill('erika@example.com');

    const { body, status } = await submit(form, submitLabel);

    expect(status).toBe(200);
    expect(body.payload).toEqual({
      name: 'Erika Muster',
      subject: 'Stress',
      message: 'Ich möchte reden.',
      contactPreference: 'email',
      email: 'erika@example.com',
    });
    await expect(form.getByRole('status')).toHaveText(DEFAULT_SUCCESS);
  });
});

test.describe('feedback form (home page)', () => {
  const submitLabel = 'Rückmeldung Absenden.';

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('is anonymous by default and only asks for name and e-mail otherwise', async ({ page }) => {
    const form = formWith(page, submitLabel);
    const anonymous = form.getByRole('checkbox', { name: 'Ich möchte anonym bleiben.' });
    await expect(anonymous).toBeChecked();
    await expect(form.getByRole('textbox', { name: 'Wie sollen wir dich nennen?' })).toBeHidden();
    await expect(form.getByRole('textbox', { name: 'E-mail Adresse' })).toBeHidden();

    await anonymous.uncheck();
    await expect(form.getByRole('textbox', { name: 'Wie sollen wir dich nennen?' })).toBeVisible();
    await expect(form.getByRole('textbox', { name: 'E-mail Adresse' })).toBeVisible();

    await form.getByRole('button', { name: submitLabel }).click();
    await expect(form.getByRole('textbox', { name: 'Wie sollen wir dich nennen?' })).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    await expect(form.getByRole('textbox', { name: 'Dein(e) Fragen, Anliegen oder Feedback' })).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });

  test('sends anonymous feedback', async ({ page }) => {
    const form = formWith(page, submitLabel);
    await form.getByRole('textbox', { name: 'Dein(e) Fragen, Anliegen oder Feedback' }).fill('Tolle Webseite!');

    const { body, status } = await submit(form, submitLabel);

    expect(status).toBe(200);
    expect(body).toEqual({ id: 'feedback', payload: { message: 'Tolle Webseite!', anonymous: 'on' } });
    await expect(form.getByRole('status')).toHaveText('Danke für deine Rückmeldung');
  });

  test('sends feedback with name and e-mail', async ({ page }) => {
    const form = formWith(page, submitLabel);
    await form.getByRole('textbox', { name: 'Dein(e) Fragen, Anliegen oder Feedback' }).fill('Tolle Webseite!');
    await form.getByRole('checkbox', { name: 'Ich möchte anonym bleiben.' }).uncheck();
    await form.getByRole('textbox', { name: 'Wie sollen wir dich nennen?' }).fill('Erika');
    await form.getByRole('textbox', { name: 'E-mail Adresse' }).fill('erika@example.com');

    const { body, status } = await submit(form, submitLabel);

    expect(status).toBe(200);
    expect(body).toEqual({
      id: 'feedback',
      payload: { message: 'Tolle Webseite!', displayName: 'Erika', email: 'erika@example.com' },
    });
    await expect(form.getByRole('status')).toHaveText('Danke für deine Rückmeldung');
  });
});

for (const { name, path } of [
  { name: 'prayer form (home page)', path: '/' },
  { name: 'prayer form (own page)', path: '/jetzt-fuer-mich-beten' },
]) {
  test.describe(name, () => {
    const submitLabel = 'Gebetsanliegen senden';

    test.beforeEach(async ({ page }) => {
      await page.goto(path);
    });

    test('shows name and e-mail only when they are needed', async ({ page }) => {
      const form = formWith(page, submitLabel);
      const displayName = form.getByRole('textbox', { name: 'Wie sollen wir dich nennen?' });
      const email = form.getByRole('textbox', { name: 'E-mail Adresse' });
      const anonymous = form.getByRole('checkbox', { name: 'Ich möchte anonym bleiben.' });
      const answer = form.getByRole('checkbox', { name: 'Ich möchte eine rückmeldung erhalten.' });

      await expect(anonymous).toBeChecked();
      await expect(displayName).toBeHidden();
      await expect(email).toBeHidden();

      await answer.check();
      await expect(email).toBeVisible();
      await expect(displayName).toBeHidden();

      await anonymous.uncheck();
      await expect(displayName).toBeVisible();

      await answer.uncheck();
      await expect(email).toBeHidden();
    });

    test('sends an anonymous prayer request', async ({ page }) => {
      const form = formWith(page, submitLabel);
      await form.getByRole('textbox', { name: 'Um welches Thema geht es?' }).fill('Gesundheit');
      await form.getByRole('textbox', { name: 'Erzähle uns mehr' }).fill('Bitte betet für meine Mutter.');

      const { body, status } = await submit(form, submitLabel);

      expect(status).toBe(200);
      expect(body).toEqual({
        id: 'prayer',
        payload: { topic: 'Gesundheit', description: 'Bitte betet für meine Mutter.', anonymous: 'on' },
      });
      await expect(form.getByRole('status')).toHaveText(DEFAULT_SUCCESS);
      // The form is back in its initial state: still anonymous, nothing left over.
      await expect(form.getByRole('checkbox', { name: 'Ich möchte anonym bleiben.' })).toBeChecked();
      await expect(form.getByRole('textbox', { name: 'Um welches Thema geht es?' })).toHaveValue('');
    });

    test('sends a named prayer request that asks for an answer', async ({ page }) => {
      const form = formWith(page, submitLabel);
      await form.getByRole('textbox', { name: 'Um welches Thema geht es?' }).fill('Arbeit');
      await form.getByRole('textbox', { name: 'Erzähle uns mehr' }).fill('Ich suche eine Stelle.');
      await form.getByRole('checkbox', { name: 'Ich möchte anonym bleiben.' }).uncheck();
      await form.getByRole('checkbox', { name: 'Ich möchte eine rückmeldung erhalten.' }).check();
      await form.getByRole('textbox', { name: 'Wie sollen wir dich nennen?' }).fill('Erika');
      await form.getByRole('textbox', { name: 'E-mail Adresse' }).fill('erika@example.com');

      const { body, status } = await submit(form, submitLabel);

      expect(status).toBe(200);
      expect(body).toEqual({
        id: 'prayer',
        payload: {
          topic: 'Arbeit',
          description: 'Ich suche eine Stelle.',
          answer: 'on',
          displayName: 'Erika',
          email: 'erika@example.com',
        },
      });
      await expect(form.getByRole('status')).toHaveText(DEFAULT_SUCCESS);
    });

    test('requires an e-mail address when an answer is wanted', async ({ page }) => {
      const form = formWith(page, submitLabel);
      await form.getByRole('textbox', { name: 'Um welches Thema geht es?' }).fill('Arbeit');
      await form.getByRole('textbox', { name: 'Erzähle uns mehr' }).fill('Ich suche eine Stelle.');
      await form.getByRole('checkbox', { name: 'Ich möchte eine rückmeldung erhalten.' }).check();

      await form.getByRole('button', { name: submitLabel }).click();

      await expect(form.getByRole('textbox', { name: 'E-mail Adresse' })).toHaveAttribute('aria-invalid', 'true');
      await expect(form.getByRole('alert')).toHaveText(INVALID_FIELDS);
    });
  });
}
