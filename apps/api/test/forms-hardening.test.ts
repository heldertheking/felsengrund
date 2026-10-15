import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkerMailer } from 'worker-mailer';
import { formSchemas, type FormId } from '@felsengrund/types/forms';
import { NotificationService } from '../src/lib';
import { FORMS } from '../src/lib/notification/types';
import {
  sanitizeAddress,
  sanitizeDisplayName,
  sanitizeHeaderText,
  sanitizeReplyTo,
} from '../src/lib/notification/headers';
import { call, postJson, testEnv } from './helpers';

// No real SMTP: the mailer is replaced for this whole file.
vi.mock('worker-mailer', () => ({
  LogLevel: { INFO: 1 },
  WorkerMailer: { send: vi.fn(async () => undefined) },
}));

const send = vi.mocked(WorkerMailer.send);

type Payload = Record<string, string | string[]>;
const parse = (id: FormId, payload: Payload) => formSchemas[id].safeParse(payload);

const contact: Payload = { name: 'Anna Muster', email: 'anna@example.com', subject: 'Hallo', message: 'Eine Frage' };
const counseling: Payload = {
  name: 'A',
  subject: 'S',
  message: 'M',
  contactPreference: 'phone',
  phone: '044 123 45 67',
};
const feedback: Payload = { message: 'Danke', displayName: 'Anna', email: 'anna@example.com' };
const prayer: Payload = { topic: 'Dank', description: 'Text', displayName: 'Anna' };

beforeEach(() => {
  send.mockReset();
  send.mockResolvedValue(undefined);
});

describe('single-line fields (they end up in mail headers)', () => {
  // [form id, base payload, single-line field]
  const cases: [FormId, Payload, string][] = [
    ['contact', contact, 'name'],
    ['contact', contact, 'subject'],
    ['counseling', counseling, 'name'],
    ['counseling', counseling, 'subject'],
    ['counseling', counseling, 'phone'],
    ['feedback', feedback, 'displayName'],
    ['prayer', prayer, 'topic'],
    ['prayer', prayer, 'displayName'],
  ];

  it.each(cases)('%s accepts a plain %s', (id, base, field) => {
    expect(parse(id, { ...base, [field]: 'Ein normaler Wert' }).success).toBe(true);
  });

  const breaks = [
    ['a line feed', 'a\nb'],
    ['a carriage return', 'a\rb'],
    ['a CRLF followed by a header', 'Hallo\r\nBcc: someone@example.com'],
    ['a tab', 'a\tb'],
    ['a NUL', 'a\u0000b'],
    ['a vertical tab', 'a\u000bb'],
    ['a next-line character', 'a\u0085b'],
    ['a Unicode line separator', 'a b'],
    ['a Unicode paragraph separator', 'a b'],
  ] as const;

  describe.each(cases)('%s field %s', (id, base, field) => {
    it.each(breaks)('rejects %s', (_label, value) => {
      expect(parse(id, { ...base, [field]: value }).success).toBe(false);
    });
  });

  it('also rejects line breaks in the email of every form that has one', () => {
    for (const [id, base] of [
      ['contact', contact],
      ['feedback', feedback],
    ] as [FormId, Payload][]) {
      expect(parse(id, { ...base, email: 'a@example.com\r\nBcc: x@example.com' }).success).toBe(false);
    }
  });

  it('caps names at 100, subjects and topics at 200 and phone numbers at 50 characters', () => {
    expect(parse('contact', { ...contact, name: 'x'.repeat(100) }).success).toBe(true);
    expect(parse('contact', { ...contact, name: 'x'.repeat(101) }).success).toBe(false);
    expect(parse('contact', { ...contact, subject: 'x'.repeat(200) }).success).toBe(true);
    expect(parse('contact', { ...contact, subject: 'x'.repeat(201) }).success).toBe(false);
    expect(parse('prayer', { ...prayer, topic: 'x'.repeat(201) }).success).toBe(false);
    expect(parse('feedback', { ...feedback, displayName: 'x'.repeat(101) }).success).toBe(false);
    expect(parse('counseling', { ...counseling, phone: '0'.repeat(50) }).success).toBe(true);
    expect(parse('counseling', { ...counseling, phone: '0'.repeat(51) }).success).toBe(false);
  });
});

describe('free text', () => {
  it.each(['message', 'description'])('allows newlines, CRLF and tabs in %s', (field) => {
    const text = 'Zeile 1\nZeile 2\r\nZeile 3\tmit Tab';
    if (field === 'message') expect(parse('contact', { ...contact, message: text }).success).toBe(true);
    else expect(parse('prayer', { ...prayer, description: text }).success).toBe(true);
  });

  it('rejects other control characters such as NUL and DEL', () => {
    expect(parse('contact', { ...contact, message: 'a\u0000b' }).success).toBe(false);
    expect(parse('contact', { ...contact, message: 'a\u007fb' }).success).toBe(false);
    expect(parse('prayer', { ...prayer, description: 'a\u0007b' }).success).toBe(false);
  });
});

describe('payload shape limits', () => {
  it('accepts up to 30 fields and rejects more', () => {
    const fields = (count: number) => Object.fromEntries(Array.from({ length: count }, (_, i) => [`extra${i}`, 'x']));
    // contact already has 4 fields
    expect(parse('contact', { ...contact, ...fields(26) }).success).toBe(true);
    expect(parse('contact', { ...contact, ...fields(27) }).success).toBe(false);
  });

  it('rejects a field name longer than 64 characters', () => {
    expect(parse('contact', { ...contact, ['n'.repeat(64)]: 'x' }).success).toBe(true);
    expect(parse('contact', { ...contact, ['n'.repeat(65)]: 'x' }).success).toBe(false);
  });

  it('accepts up to 20 items in a repeated field and rejects more', () => {
    expect(parse('contact', { ...contact, extra: Array.from({ length: 20 }, () => 'x') }).success).toBe(true);
    expect(parse('contact', { ...contact, extra: Array.from({ length: 21 }, () => 'x') }).success).toBe(false);
  });
});

describe('header sanitising', () => {
  it('turns control characters and line breaks into single spaces and caps the length', () => {
    expect(sanitizeHeaderText('Hallo\r\nBcc: x@example.com')).toBe('Hallo Bcc: x@example.com');
    expect(sanitizeHeaderText('a b\u0085c\u0000d\te')).toBe('a b c d e');
    expect(sanitizeHeaderText('  viel   Platz  ')).toBe('viel Platz');
    expect(sanitizeHeaderText('x'.repeat(500)).length).toBe(200);
    expect(sanitizeHeaderText('Grüezi, Zürich: ä ö ü')).toBe('Grüezi, Zürich: ä ö ü');
  });

  it('removes quotes, backslashes and angle brackets from display names', () => {
    expect(sanitizeDisplayName('Anna "Annie" <evil@example.com>')).toBe('Anna Annie evil@example.com');
    expect(sanitizeDisplayName('a\\b')).toBe('ab');
    expect(sanitizeDisplayName('Zoë Müller')).toBe('Zoë Müller');
    expect(sanitizeDisplayName('  ')).toBeUndefined();
    expect(sanitizeDisplayName(undefined)).toBeUndefined();
  });

  it.each([
    ['a@example.com', 'a@example.com'],
    ['first.last+tag@sub.example.ch', 'first.last+tag@sub.example.ch'],
    ['a@example.com\r\nBcc: x@example.com', undefined],
    ['a b@example.com', undefined],
    ['"a"@example.com', undefined],
    ['a@example.com>, evil@example.com', undefined],
    ['a@@example.com', undefined],
    ['@example.com', undefined],
    ['a@', undefined],
    ['plain', undefined],
  ])('sanitizeAddress(%j) -> %j', (input, expected) => {
    expect(sanitizeAddress(input)).toBe(expected);
  });

  it('builds a safe Reply-To and drops it when the address cannot be made safe', () => {
    expect(sanitizeReplyTo({ name: 'Anna "A" <x>', email: 'anna@example.com' })).toEqual({
      name: 'Anna A x',
      email: 'anna@example.com',
    });
    expect(sanitizeReplyTo('anna@example.com')).toEqual({ email: 'anna@example.com' });
    expect(sanitizeReplyTo({ name: 'Anna', email: 'anna@example.com\r\nBcc: x@y.z' })).toBeUndefined();
    expect(sanitizeReplyTo(undefined)).toBeUndefined();
  });
});

describe('NotificationService header handling', () => {
  const content = { heading: 'H', intro: 'I', fields: [], message: { label: 'M', value: 'v' } };
  const env = { ...testEnv, ENVIRONMENT: 'production' as const };

  it('never passes a line break to the mailer, even when a caller forgets to check', async () => {
    await new NotificationService().send(
      {
        subject: 'Kontaktformular: Hallo\r\nBcc: attacker@example.com',
        content,
        mailbox: FORMS.CONTACT,
        options: { replyTo: { name: 'Anna\r\nTo: x@example.com', email: 'anna@example.com' } },
      },
      env,
    );

    const [, email] = send.mock.calls[0];
    expect(email.subject).toBe('Kontaktformular: Hallo Bcc: attacker@example.com');
    expect(email.reply).toEqual({ name: 'Anna To: x@example.com', email: 'anna@example.com' });
    expect(JSON.stringify([email.subject, email.reply])).not.toMatch(/[\r\n]/);
  });

  it('drops an unusable Reply-To instead of sending it', async () => {
    await new NotificationService().send(
      {
        subject: 'S',
        content,
        mailbox: FORMS.CONTACT,
        options: { replyTo: { name: 'Anna', email: 'anna@example.com\r\nBcc: x@example.com' } },
      },
      env,
    );
    expect(send.mock.calls[0][1].reply).toBeUndefined();
  });
});

describe('POST /forms request size', () => {
  it('answers 413 for a body above the limit and sends nothing', async () => {
    const huge = { id: 'contact', payload: { ...contact, padding: 'x'.repeat(40 * 1024) } };
    const res = await postJson('/forms', huge);
    expect(res.status).toBe(413);
    expect(await res.json()).toMatchObject({ status: 'error', message: 'Die Anfrage ist zu gross.' });
    expect(send).not.toHaveBeenCalled();
  });

  it('still accepts a normal submission and a long but legitimate message', async () => {
    const res = await postJson('/forms', { id: 'contact', payload: { ...contact, message: 'x'.repeat(5000) } });
    expect(res.status).toBe(200);
    expect(send).toHaveBeenCalledTimes(1);
  });
});

describe('POST /forms rate limit', () => {
  const production = { ENVIRONMENT: 'production' as const };
  const limiter = (success: boolean) => ({ limit: vi.fn(async () => ({ success })) });
  const submit = (overrides: Parameters<typeof postJson>[2], headers: Record<string, string> = {}) =>
    call(
      '/forms',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ id: 'contact', payload: contact }),
      },
      overrides,
    );

  it('answers 429 with Retry-After and sends nothing when the client is over the limit', async () => {
    const res = await submit({ ...production, FORMS_RATE_LIMITER: limiter(false) });
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('60');
    expect(await res.json()).toMatchObject({ status: 'error', message: expect.stringContaining('Zu viele Anfragen') });
    expect(send).not.toHaveBeenCalled();
  });

  it('keys the limit on the Cloudflare client address', async () => {
    const stub = limiter(true);
    const res = await submit({ ...production, FORMS_RATE_LIMITER: stub }, { 'cf-connecting-ip': '203.0.113.7' });
    expect(res.status).toBe(200);
    expect(stub.limit).toHaveBeenCalledWith({ key: '203.0.113.7' });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('falls back to a shared key when no client address is present', async () => {
    const stub = limiter(true);
    await submit({ ...production, FORMS_RATE_LIMITER: stub });
    expect(stub.limit).toHaveBeenCalledWith({ key: 'unknown' });
  });

  it('lets requests through (and logs) when a deployed environment has no limiter binding', async () => {
    const res = await submit({ ...production, FORMS_RATE_LIMITER: undefined });
    expect(res.status).toBe(200);
  });

  it('does not consult the limiter in the local environment', async () => {
    const stub = limiter(false);
    const res = await submit({ ENVIRONMENT: 'local', FORMS_RATE_LIMITER: stub });
    expect(res.status).toBe(200);
    expect(stub.limit).not.toHaveBeenCalled();
  });

  it('enforces the limit in the development environment too', async () => {
    const res = await submit({ ENVIRONMENT: 'development', FORMS_RATE_LIMITER: limiter(false) });
    expect(res.status).toBe(429);
  });

  it('counts rejected submissions too, because the limit runs before validation', async () => {
    const stub = limiter(true);
    const res = await call(
      '/forms',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"id":"contact","payload":{}}' },
      { ...production, FORMS_RATE_LIMITER: stub },
    );
    expect(res.status).toBe(400);
    expect(stub.limit).toHaveBeenCalledTimes(1);
  });
});
