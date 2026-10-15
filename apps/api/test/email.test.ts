import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkerMailer } from 'worker-mailer';
import { NotificationService, FORMS } from '../src/lib';
import { EmailBase } from '../src/lib/notification/template/base';
import { renderDevBanner } from '../src/lib/notification/template/dev-banner';
import { escapeHtml, escapeHtmlMultiline } from '../src/lib/notification/template/escape-html';
import { emailTheme } from '../src/lib/notification/template/theme';
import { buildFormNotification } from '../src/lib/form-notifications';
import { testEnv } from './helpers';

vi.mock('worker-mailer', () => ({
  LogLevel: { INFO: 1 },
  WorkerMailer: { send: vi.fn(async () => undefined) },
}));

const send = vi.mocked(WorkerMailer.send);
const ATTACK = `<script>alert("x")</script> & 'quote'`;
const ESCAPED_ATTACK = '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;quote&#39;';

beforeEach(() => {
  send.mockReset();
  send.mockResolvedValue(undefined);
});

describe('escapeHtml', () => {
  it('escapes the five HTML special characters', () => {
    expect(escapeHtml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;');
  });

  it('does not double-escape in a single pass and leaves plain text alone', () => {
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
    expect(escapeHtml('Grüsse aus Oetwil')).toBe('Grüsse aus Oetwil');
  });

  it('turns every kind of newline into <br> after escaping', () => {
    expect(escapeHtmlMultiline('a\r\nb\nc\rd<')).toBe('a<br>b<br>c<br>d&lt;');
  });
});

describe('EmailBase', () => {
  it('renders heading, intro, fields and message', () => {
    const html = EmailBase.newBuilder()
      .setContent({
        heading: 'Neue Anfrage',
        intro: 'Einleitung',
        fields: [{ label: 'Name', value: 'Anna' }],
        message: { label: 'Nachricht', value: 'Zeile 1\nZeile 2' },
      })
      .build();
    expect(html).toContain('<h1');
    expect(html).toContain('Neue Anfrage</h1>');
    expect(html).toContain('Einleitung');
    expect(html).toMatch(/>Name<\/span>/);
    expect(html).toMatch(/>Anna<\/span>/);
    expect(html).toContain('Zeile 1<br>Zeile 2');
    expect(html).toContain(emailTheme.brand.name);
  });

  it('escapes user input in every slot', () => {
    const html = EmailBase.newBuilder()
      .setContent({
        heading: ATTACK,
        intro: ATTACK,
        fields: [{ label: ATTACK, value: ATTACK }],
        message: { label: ATTACK, value: ATTACK },
      })
      .build();
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('alert("x")');
    expect(html.split(ESCAPED_ATTACK).length - 1).toBeGreaterThanOrEqual(6); // incl. the hidden preview text
  });

  it('cannot be broken out of an attribute or tag by a message', () => {
    const html = EmailBase.newBuilder()
      .setContent({ heading: 'h', message: { label: 'l', value: '"><img src=x onerror=alert(1)>' } })
      .build();
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&quot;&gt;&lt;img src=x onerror=alert(1)&gt;');
  });

  it('skips fields without a value and omits the message block when empty', () => {
    const html = EmailBase.newBuilder()
      .setContent({
        heading: 'h',
        fields: [
          { label: 'Behalten', value: 'ja' },
          { label: 'Leer', value: '' },
          { label: 'Fehlt', value: undefined },
        ],
        message: { label: 'Nachricht', value: '' },
      })
      .build();
    expect(html).toContain('Behalten');
    expect(html).not.toContain('Leer');
    expect(html).not.toContain('Fehlt');
    expect(html).not.toContain('>Nachricht<');
  });

  it('prefers setFields over content.fields', () => {
    const html = EmailBase.newBuilder()
      .setContent({ heading: 'h', fields: [{ label: 'Alt', value: 'a' }] })
      .setFields([{ label: 'Neu', value: 'n' }])
      .build();
    expect(html).toContain('Neu');
    expect(html).not.toContain('>Alt<');
  });

  it('inserts the banner and applies a custom theme', () => {
    const html = EmailBase.newBuilder()
      .setContent({ heading: 'h' })
      .setBanner('<tr><td id="banner">hinweis</td></tr>')
      .setTheme({ ...emailTheme, brand: { ...emailTheme.brand, name: 'Andere <Kirche>' } })
      .build();
    expect(html).toContain('<td id="banner">hinweis</td>');
    expect(html).toContain('Andere &lt;Kirche&gt;');
  });

  it('uses the message as the hidden preview text, falling back to intro then heading', () => {
    const preview = (content: Parameters<ReturnType<typeof EmailBase.newBuilder>['setContent']>[0]) =>
      /display:none[^>]*>\s*([^\n&]*)/.exec(EmailBase.newBuilder().setContent(content).build())?.[1].trim();
    expect(preview({ heading: 'H', intro: 'I', message: { label: 'l', value: 'M' } })).toBe('M');
    expect(preview({ heading: 'H', intro: 'I' })).toBe('I');
    expect(preview({ heading: 'H' })).toBe('H');
  });
});

describe('renderDevBanner', () => {
  it('names the environment and original recipient, escaped', () => {
    const html = renderDevBanner('development', 'a@b.test');
    expect(html).toContain('Testumgebung (development)');
    expect(html).toContain('<strong>a@b.test</strong>');
    expect(renderDevBanner('<x>', '<y>')).not.toMatch(/<x>|<y>/);
  });
});

describe('form notification mails', () => {
  it('escapes hostile form input in the rendered email', async () => {
    const notification = buildFormNotification('contact', {
      name: ATTACK,
      email: 'anna@example.com',
      subject: ATTACK,
      message: `${ATTACK}\nzweite Zeile`,
    });
    await new NotificationService().send(notification, testEnv);

    const [, email] = send.mock.calls[0];
    const html = (email as { html: string }).html;
    expect(html).not.toContain('<script>');
    expect(html).toContain(ESCAPED_ATTACK);
    expect(html).toContain('<br>zweite Zeile');
  });
});

describe('NotificationService', () => {
  const notification = buildFormNotification('prayer', { topic: 'Dank', description: 'D', anonymous: 'on' });

  it('maps each form to its mailbox in production', async () => {
    const service = new NotificationService();
    const prod = { ...testEnv, ENVIRONMENT: 'production' as const };
    const cases: [FORMS, string][] = [
      [FORMS.CONTACT, 'kontakt@kirche-felsengrund.ch'],
      [FORMS.PRAYER_REQUEST, 'gebetsanliegen@kirche-felsengrund.ch'],
      [FORMS.CONSOLING, 'lebensberatung@kirche-felsengrund.ch'],
      [FORMS.UNSPECIFIED, 'kontakt@kirche-felsengrund.ch'],
    ];
    for (const [mailbox, to] of cases) {
      send.mockClear();
      await service.send({ ...notification, mailbox }, prod);
      expect(send.mock.calls[0][1].to).toBe(to);
    }
  });

  it('redirects to the dev inbox with a banner and subject prefix outside production', async () => {
    await new NotificationService().send(notification, { ...testEnv, ENVIRONMENT: 'development' });
    const [, email] = send.mock.calls[0];
    expect(email.to).toBe('dev-inbox@example.test');
    expect(email.subject).toBe('[development] Gebetsanliegen: Dank');
    expect((email as { html: string }).html).toContain('gebetsanliegen@kirche-felsengrund.ch');
    expect((email as { html: string }).html).toContain('Testumgebung');
  });

  it('never falls back to the real mailbox outside production', async () => {
    await new NotificationService().send(notification, { ...testEnv, KFA_DEV_NOTIFICATION_RECIPIENT: undefined });
    expect(send).not.toHaveBeenCalled();
  });

  it('throws without mail credentials', async () => {
    await expect(
      new NotificationService().send(notification, { ...testEnv, KFA_MAIL_PASSWORD: undefined }),
    ).rejects.toThrow('Mail credentials are not configured.');
  });

  it('propagates mailer failures', async () => {
    send.mockRejectedValueOnce(new Error('boom'));
    await expect(new NotificationService().send(notification, testEnv)).rejects.toThrow('boom');
  });

  it('passes the SMTP configuration and auth methods to the mailer', async () => {
    await new NotificationService().send(notification, testEnv);
    const [options] = send.mock.calls[0];
    expect(options).toMatchObject({ host: 'mail.webkeeper.ch', port: 465, secure: true, authType: ['plain', 'login'] });
  });
});
