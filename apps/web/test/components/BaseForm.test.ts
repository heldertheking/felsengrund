/**
 * BaseForm.astro keeps its behaviour in an inline `<script>`. Astro components cannot be rendered
 * outside Astro, so this test loads that script through the `?astro-script` query handled by
 * `vitest.config.ts` and runs it against hand-written markup that mirrors what FormField,
 * FormRadioGroup, FormConditional and BaseForm render. The network layer (`sendForm`) is mocked.
 */
import userEvent from '@testing-library/user-event';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sendForm } from '../../src/lib/forms';

vi.mock('../../src/lib/forms', () => ({ sendForm: vi.fn() }));

const realAddEventListener = EventTarget.prototype.addEventListener;
const sendFormMock = vi.mocked(sendForm);

/** The script registers its listeners on `document` at import time; track them so each test starts clean. */
let registered: [string, EventListenerOrEventListenerObject][] = [];

async function mountForm(innerHtml: string, attrs = '') {
  document.body.innerHTML = `
    <form novalidate data-base-form data-form-id="contact" data-submit-label="Absenden"
      data-submitting-label="Wird gesendet…" data-success-message="Danke!" data-error-message="Fehler!" ${attrs}>
      ${innerHtml}
      <div aria-hidden="true"><label>Website
        <input type="text" name="website" tabindex="-1" autocomplete="off" data-honeypot /></label></div>
      <p data-required-note hidden>Pflichtfeld</p>
      <button type="submit" data-submit>Absenden</button>
      <p data-status role="status" aria-live="polite" tabindex="-1"></p>
    </form>`;

  // The script registers its listeners on `document` once, at import. To get a fresh script per test we
  // record those registrations (removed again in afterEach) and re-import it after `vi.resetModules()`.
  vi.spyOn(document, 'addEventListener').mockImplementation((type, listener, options) => {
    registered.push([type, listener]);
    realAddEventListener.call(document, type, listener, options);
  });
  vi.resetModules();
  // @ts-expect-error The `?astro-script` module is produced by the Vite plugin in vitest.config.ts.
  await import('../../src/components/form/BaseForm.astro?astro-script');

  return document.querySelector('form') as HTMLFormElement;
}

function field(name: string, label: string, { required = false, type = 'text', extra = '', hint = '' } = {}) {
  const id = `field-${name}`;
  return `
    <div data-field>
      <label for="${id}">${label}</label>
      <input id="${id}" name="${name}" type="${type}" ${required ? 'required' : ''} ${extra}
        ${hint ? `aria-describedby="${id}-hint" data-base-describedby="${id}-hint"` : ''} />
      ${hint ? `<p id="${id}-hint">${hint}</p>` : ''}
      <p id="${id}-error" data-field-error hidden></p>
    </div>`;
}

function radios(name: string, values: string[], required = true) {
  return `
    <fieldset id="field-${name}" data-field data-group>
      <legend>${name}</legend>
      ${values.map((v) => `<label><input type="radio" name="${name}" value="${v}" ${required ? 'required' : ''} />${v}</label>`).join('')}
      <p id="field-${name}-error" data-field-error hidden></p>
    </fieldset>`;
}

function conditional(when: string, is: string, inner: string) {
  return `<div data-show-when="${when}" data-show-is="${is}">${inner}</div>`;
}

/** Pastes (one `input` event) instead of typing key by key; typing is only the point of the live re-validation test. */
async function fill(el: HTMLElement, text: string) {
  await userEvent.click(el);
  await userEvent.paste(text);
}

const status = () => document.querySelector<HTMLElement>('[data-status]')!;
const submitButton = () => document.querySelector<HTMLButtonElement>('[data-submit]')!;

beforeEach(() => {
  sendFormMock.mockReset();
  sendFormMock.mockResolvedValue(undefined);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  for (const [type, listener] of registered) document.removeEventListener(type, listener);
  registered = [];
  document.body.innerHTML = '';
});

describe('validation messages', () => {
  it('flags an empty required field with a German message, aria-invalid and aria-describedby, and focuses it', async () => {
    const form = await mountForm(field('name', 'Name', { required: true, hint: 'Dein Name' }));

    fireEvent.submit(form);

    const input = screen.getByLabelText('Name');
    expect(document.getElementById('field-name-error')).toHaveTextContent('Bitte fülle dieses Feld aus.');
    expect(document.getElementById('field-name-error')).toBeVisible();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'field-name-hint field-name-error');
    expect(input).toHaveFocus();
    expect(status()).toHaveTextContent('Bitte überprüfe die markierten Felder.');
    expect(status()).toHaveAttribute('role', 'alert');
    expect(sendFormMock).not.toHaveBeenCalled();
  });

  it('uses specific messages for emails, URLs, patterns and ranges', async () => {
    const form = await mountForm(
      field('email', 'E-Mail', { type: 'email' }) +
        field('site', 'Site', { type: 'url' }) +
        field('plz', 'PLZ', { extra: 'pattern="[0-9]{4}"' }) +
        field('code', 'Code', { extra: 'pattern="[0-9]{4}" title="Vier Ziffern"' }) +
        field('age', 'Alter', { type: 'number', extra: 'min="18" max="99"' }),
    );
    await fill(screen.getByLabelText('E-Mail'), 'kein-email');
    await fill(screen.getByLabelText('Site'), 'kein url');
    await fill(screen.getByLabelText('PLZ'), 'abc');
    await fill(screen.getByLabelText('Code'), 'abc');
    await fill(screen.getByLabelText('Alter'), '5');

    fireEvent.submit(form);

    const text = (id: string) => document.getElementById(`field-${id}-error`)!.textContent;
    expect(text('email')).toBe('Bitte gib eine gültige E-Mail-Adresse ein.');
    expect(text('site')).toBe('Bitte gib eine gültige Web-Adresse ein.');
    expect(text('plz')).toBe('Bitte überprüfe das Format deiner Eingabe.');
    expect(text('code')).toBe('Vier Ziffern');
    expect(text('age')).toBe('Der Wert ist zu klein.');

    await userEvent.clear(screen.getByLabelText('Alter'));
    await fill(screen.getByLabelText('Alter'), '150');
    fireEvent.submit(form);
    expect(text('age')).toBe('Der Wert ist zu groß.');
  });

  it('reports a missing radio choice once per group, on the fieldset', async () => {
    const form = await mountForm(radios('contact', ['mail', 'phone']));

    fireEvent.submit(form);

    const fieldset = document.getElementById('field-contact')!;
    expect(document.getElementById('field-contact-error')).toHaveTextContent('Bitte wähle eine Option aus.');
    expect(fieldset).toHaveAttribute('aria-invalid', 'true');
    expect(fieldset).toHaveAttribute('aria-describedby', 'field-contact-error');
    expect(screen.getByLabelText('mail')).toHaveFocus();
  });

  it('uses the choice/confirm messages for selects and checkboxes', async () => {
    const form = await mountForm(`
      <div data-field><label for="s">Auswahl</label>
        <select id="s" name="s" required><option value="">Bitte</option><option value="a">A</option></select>
        <p id="s-error" data-field-error hidden></p></div>
      <div data-field><label for="c">Ok</label><input id="c" name="c" type="checkbox" required />
        <p id="c-error" data-field-error hidden></p></div>`);

    fireEvent.submit(form);

    expect(document.getElementById('s-error')).toHaveTextContent('Bitte wähle eine Option aus.');
    expect(document.getElementById('c-error')).toHaveTextContent('Bitte bestätige dieses Feld.');
  });

  it('re-validates a flagged field live and clears the error once it is fixed', async () => {
    const form = await mountForm(field('email', 'E-Mail', { required: true, type: 'email', hint: 'Hinweis' }));
    fireEvent.submit(form);
    const input = screen.getByLabelText('E-Mail');
    const error = document.getElementById('field-email-error')!;
    expect(error).toHaveTextContent('Bitte fülle dieses Feld aus.');

    await userEvent.type(input, 'abc');
    expect(error).toHaveTextContent('Bitte gib eine gültige E-Mail-Adresse ein.');

    await userEvent.type(input, '@example.ch');
    expect(error).toBeEmptyDOMElement();
    expect(error).not.toBeVisible();
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).toHaveAttribute('aria-describedby', 'field-email-hint');
  });

  it('does not flag fields that were never submitted while typing', async () => {
    await mountForm(field('email', 'E-Mail', { required: true, type: 'email' }));
    await fill(screen.getByLabelText('E-Mail'), 'abc');
    expect(screen.getByLabelText('E-Mail')).not.toHaveAttribute('aria-invalid');
  });
});

describe('required note', () => {
  it('is shown only for forms with required fields', async () => {
    await mountForm(field('name', 'Name', { required: true }));
    expect(document.querySelector('[data-required-note]')).toBeVisible();
    for (const [type, listener] of registered) document.removeEventListener(type, listener);
    registered = [];

    await mountForm(field('name', 'Name'));
    expect(document.querySelector('[data-required-note]')).not.toBeVisible();
  });
});

describe('conditional sections', () => {
  const markup = () =>
    radios('contact', ['mail', 'phone'], false) +
    conditional('contact', 'phone', field('phone', 'Telefon', { required: true })) +
    conditional('contact', '!phone', field('mailaddr', 'Mail', { required: true }));

  it('shows the matching section, disables and skips validation for the hidden one', async () => {
    const form = await mountForm(markup());
    // Initial state: nothing chosen, so "phone" is hidden and the negated "!phone" section is shown.
    const phoneSection = document.querySelector<HTMLElement>('[data-show-is="phone"]')!;
    const mailSection = document.querySelector<HTMLElement>('[data-show-is="!phone"]')!;
    expect(phoneSection).not.toBeVisible();
    expect(mailSection).toBeVisible();

    await userEvent.click(screen.getByLabelText('mail'));
    expect(phoneSection).not.toBeVisible();
    expect(screen.queryByLabelText('Telefon')).toBeDisabled();

    fireEvent.submit(form);
    // Only the visible section's field is validated.
    expect(document.getElementById('field-mailaddr-error')).toHaveTextContent('Bitte fülle dieses Feld aus.');
    expect(document.getElementById('field-phone-error')).toBeEmptyDOMElement();
  });

  it('re-enables controls it disabled when the section becomes visible again', async () => {
    await mountForm(markup());
    await userEvent.click(screen.getByLabelText('mail'));
    await userEvent.click(screen.getByLabelText('phone'));

    expect(screen.getByLabelText('Telefon')).toBeEnabled();
    expect(screen.getByLabelText('Mail')).toBeDisabled();
    expect(screen.getByLabelText('Telefon')).toBeVisible();
  });

  it('leaves controls that were disabled by the author alone', async () => {
    await mountForm(
      radios('contact', ['mail', 'phone'], false) +
        conditional('contact', 'phone', field('phone', 'Telefon', { extra: 'disabled' })),
    );
    await userEvent.click(screen.getByLabelText('mail'));
    await userEvent.click(screen.getByLabelText('phone'));
    expect(screen.getByLabelText('Telefon')).toBeDisabled();
  });

  it('supports comma-separated values and negation with checkboxes', async () => {
    await mountForm(`
      <div data-field><label><input type="checkbox" name="anonymous" /> Anonym</label></div>
      ${conditional('anonymous', '!on', field('fullname', 'Name', { required: true }))}`);
    expect(screen.getByLabelText('Name')).toBeVisible();

    await userEvent.click(screen.getByLabelText('Anonym'));
    expect(screen.getByLabelText('Name')).not.toBeVisible();
    expect(screen.getByLabelText('Name')).toBeDisabled();

    await userEvent.click(screen.getByLabelText('Anonym'));
    expect(screen.getByLabelText('Name')).toBeVisible();
  });

  it('hides nested sections along with their parent', async () => {
    await mountForm(
      radios('kind', ['a', 'b'], false) +
        conditional(
          'kind',
          'a',
          field('outer', 'Outer') + conditional('outer', 'x,y', field('inner', 'Inner', { required: true })),
        ),
    );
    await userEvent.click(screen.getByLabelText('a'));
    await fill(screen.getByLabelText('Outer'), 'x');
    await userEvent.tab(); // `change` (which re-evaluates the sections) fires on blur for text inputs
    expect(screen.getByLabelText('Inner')).toBeVisible();

    await userEvent.click(screen.getByLabelText('b'));
    expect(screen.getByLabelText('Outer')).toBeDisabled();
    expect(screen.getByLabelText('Inner')).toBeDisabled();
  });
});

describe('honeypot', () => {
  it('pretends success without sending when the trap is filled', async () => {
    const form = await mountForm(field('name', 'Name', { required: true }));
    await fill(screen.getByLabelText('Name'), 'Bot');
    form.querySelector<HTMLInputElement>('[data-honeypot]')!.value = 'http://spam';

    fireEvent.submit(form);

    expect(sendFormMock).not.toHaveBeenCalled();
    expect(status()).toHaveTextContent('Danke!');
    expect(status()).toHaveAttribute('data-state', 'success');
    expect(screen.getByLabelText('Name')).toHaveValue('');
  });

  it('is never validated and never part of the payload', async () => {
    const form = await mountForm(field('name', 'Name'));
    await fill(screen.getByLabelText('Name'), 'Anna');
    fireEvent.submit(form);
    await waitFor(() => expect(sendFormMock).toHaveBeenCalled());
    expect(sendFormMock.mock.calls[0][1]).not.toHaveProperty('website');
  });
});

describe('submitting', () => {
  it('sends the trimmed payload (omitting empties, merging repeated names) under the form id', async () => {
    const form = await mountForm(
      field('name', 'Name', { required: true }) +
        field('note', 'Notiz') +
        `<input type="checkbox" name="topic" value="a" checked /><input type="checkbox" name="topic" value="b" checked />
         <input type="checkbox" name="solo" value="s" checked />`,
    );
    await fill(screen.getByLabelText('Name'), '  Anna  ');

    fireEvent.submit(form);

    await waitFor(() => expect(sendFormMock).toHaveBeenCalledTimes(1));
    expect(sendFormMock).toHaveBeenCalledWith('contact', { name: 'Anna', topic: ['a', 'b'], solo: 's' });
  });

  it('shows a busy state while sending, ignores double submits, then reports success and resets', async () => {
    let finish!: () => void;
    sendFormMock.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
    const form = await mountForm(field('name', 'Name', { required: true }));
    await fill(screen.getByLabelText('Name'), 'Anna');

    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(sendFormMock).toHaveBeenCalledTimes(1);
    expect(form).toHaveAttribute('aria-busy', 'true');
    expect(submitButton()).toHaveAttribute('aria-disabled', 'true');
    expect(submitButton()).toHaveTextContent('Wird gesendet…');

    finish();
    await waitFor(() => expect(status()).toHaveTextContent('Danke!'));
    expect(status()).toHaveAttribute('data-state', 'success');
    expect(status()).toHaveAttribute('role', 'status');
    expect(status()).toHaveFocus();
    expect(form).toHaveAttribute('aria-busy', 'false');
    expect(submitButton()).toHaveAttribute('aria-disabled', 'false');
    expect(submitButton()).toHaveTextContent('Absenden');
    expect(screen.getByLabelText('Name')).toHaveValue('');
  });

  it('shows the error message as an alert and keeps the typed values when sending fails', async () => {
    sendFormMock.mockRejectedValue(new Error('boom'));
    const form = await mountForm(field('name', 'Name', { required: true }));
    await fill(screen.getByLabelText('Name'), 'Anna');

    fireEvent.submit(form);

    await waitFor(() => expect(status()).toHaveTextContent('Fehler!'));
    expect(status()).toHaveAttribute('data-state', 'error');
    expect(status()).toHaveAttribute('role', 'alert');
    expect(status()).toHaveAttribute('aria-live', 'assertive');
    expect(screen.getByLabelText('Name')).toHaveValue('Anna');
    expect(submitButton()).toHaveAttribute('aria-disabled', 'false');

    // A retry is possible after the failure.
    sendFormMock.mockResolvedValue(undefined);
    fireEvent.submit(form);
    await waitFor(() => expect(status()).toHaveTextContent('Danke!'));
    expect(sendFormMock).toHaveBeenCalledTimes(2);
  });

  it('clears a previous status when submitting again', async () => {
    const form = await mountForm(field('name', 'Name', { required: true }));
    fireEvent.submit(form);
    expect(status()).toHaveTextContent('Bitte überprüfe die markierten Felder.');

    await fill(screen.getByLabelText('Name'), 'Anna');
    fireEvent.submit(form);
    await waitFor(() => expect(status()).toHaveTextContent('Danke!'));
  });
});
